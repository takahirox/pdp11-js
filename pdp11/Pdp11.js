/**
 * PDP-11/40 processor
 */

__jsimport( "pdp11/Memory.js" ) ;
__jsimport( "pdp11/Psw.js" ) ;
__jsimport( "pdp11/Apr.js" ) ;
__jsimport( "pdp11/Clock.js" ) ;
__jsimport( "pdp11/Terminal.js" ) ;
__jsimport( "pdp11/Disk.js" ) ;
__jsimport( "pdp11/Mmu.js" ) ;
__jsimport( "pdp11/Register.js" ) ;
__jsimport( "pdp11/Util.js" ) ;
__jsimport( "pdp11/Disassembler.js" ) ;
__jsimport( "pdp11/SystemCall.js" ) ;
__jsimport( "pdp11/DebugFigureView.js" ) ;


/**
 * @constructor
 */
function Pdp11( terminalView, figureCanvas ) {
  this.memory = new Memory( ) ;
  this.psw = new Psw( ) ;
  this.apr = new Apr( ) ;
  this.apr.setPsw( this.psw ) ;
  this.clock = new Clock( this ) ;
  this.terminal = new Terminal( this, terminalView ) ;
  this.disk = new Disk( this ) ;
  this.debugFigureView = new DebugFigureView( this, figureCanvas ) ;

  this.mmu = new Mmu( this ) ;
  this.mmu.setApr( this.apr ) ;
  this.mmu.setPsw( this.psw ) ;
  this.mmu.setClock( this.clock ) ;
  this.mmu.setTerminal( this.terminal ) ;
  this.mmu.setMemory( this.memory ) ;
  this.mmu.setDisk( this.disk ) ;

  // TODO: use unified registers except for stack point register.
  this.kernelRegs = new Array( ) ;
  this.userRegs = new Array( ) ;
  for( var i = 0; i < Pdp11._NUM_OF_REGISTERS; i++ ) {
    this.kernelRegs.push( new Register( ) ) ;
    this.userRegs.push( new Register( ) ) ;
  }

  this.br = [ ] ;
  for( var i = 0; i < 8; i++ )
    this.br.push( [ ] ) ;

  this.interrupt_vector = 0 ;
  this.interrupt_level = 0 ;
  this.trap_vector = 0 ;
  this.wait = false ;
  this.stop = false ;
  this.break = false ;
  this.prePc = 0 ;
  this.op = null ;
  this.code = null ;

  this.debugFlags = {
    'instruction' : false,
    'trap' : false,
    'interrupt' : false,
    'systemCall' : false,
    'kernelSymbol' : false
  } ;

  this.disassembler = new Disassembler( this ) ;
  this.breakPoints = [ ] ;
}

Pdp11._NUM_OF_REGISTERS = 8 ;
Pdp11._REGISTER_SP = 6 ;
Pdp11._REGISTER_PC = 7 ;

Pdp11._WIDTH_BYTE = 1 ;
Pdp11._WIDTH_WORD = 2 ;

Pdp11._HISTORY_LENGTH = 20 ;

Pdp11._LOOP = 4000 ; // temporary

Pdp11._BOOT_ROM_FOR_RK05 = [
  012700,
  177414,
  005040,
  005040,
  010040,
  012740,
  000005,
  105710,
  002376,
  005007
] ;

Pdp11._BOOT_DATA_ADDRESS = 02000 ;


/**
 *
 */
Pdp11.prototype.run = function( ) {
  var self = this ;
  var runStep = function( ) {
    self.runStep( ) ;
    if( ! self.break || self.wait )
      self._asyncCall( runStep ) ;
  } ;
  runStep( ) ;
} ;


/**
 *
 */
Pdp11.prototype.runStep = function( step ) {
  if( step == undefined )
    step = Pdp11._LOOP ;
  this.debugFigureView.update( ) ;
  for( var count = 0; count < step; count++ ) {

    if( this.stop ) {
      this._dumpLog( ) ;
      return ;
    }

    try {

      if( ! this.wait && __logger.level != Logger.NONE_LEVEL )
        __logger.log( this.dump( ) ) ;

      this._runPeripherals( ) ;
      this._handleTrapAndInterrupt( ) ;

      if( this.wait ) {
        continue ;
      }

      if( this.breakPoints.indexOf( this._getPc( ).readWord( ) ) >= 0 ) {
        this.break = true ;
        __debugView.outputLine( 'break point at ' + format( this._getPc( ).readWord( ) ) ) ;
      }

      if( this.break ) {
        __pdp11View.clear( ) ;
        __pdp11View.outputLine( this.dump( ) ) ;
        __stackView.clear( ) ;
        __stackView.outputLine( this.stackDump( ) ) ;

        // TODO: bad logic
        var code = this._fetch( ) ;
        var op = this._decode( code ) ;
        this._getPc( ).decrementWord( ) ;
        __debugView.outputLine( this.disassembler.run( op, code ) ) ;

        stopAtBreakPoint( ) ;
        return ;
      }

      this._executeInstruction( ) ;

    // TODO: duplicated logic
    } catch( e ) {
      this._catchException( e ) ;
    }

  }
} ;


/**
 *
 */
Pdp11.prototype._executeInstruction = function( ) {

  this.prePc = this._getPc( ).readWord( ) ;
  var code = this._fetch( ) ;
  var op = this._decode( code ) ;

  op.run( this, code ) ;

  if( this.debugFlags[ 'systemCall' ] && op && op.op == 'trap' ) {
    var buffer = 'systemcall ' + SystemCall[ code & 0xff ].name ;
    // if indirect call
    if( ( code & 0xff ) == 0 ) {
      var sysOp = this.mmu.loadWord( this.mmu.loadWord( this._getPc( ).readWord( ) ) ) ;
      buffer += '(' + SystemCall[ sysOp & 0xff ].name + ')' ;
    }
    __debugView.outputLine( buffer ) ;
  }

} ;


/**
 *
 */
Pdp11.prototype._catchException = function( e ) {
  // temporal
  if( e.name == 'RangeError' ) {
    this.trap( 0250 ) ;
  } else {
    __logger.log( e.stack ) ;
    this._dumpLog( ) ;
    throw e ;
  }
} ;


/**
 * TODO: duplicated code.
 */
Pdp11.prototype.resume = function( ) {
  try {
    this._executeInstruction( ) ;
  // TODO: duplicated code.
  } catch( e ) {
    this._catchException( e ) ;
  }
  this.run( ) ;
} ;


/**
 *
 */
Pdp11.prototype._runPeripherals = function( ) {
  this.clock.run( ) ;
  this.terminal.run( ) ;
  this.disk.run( ) ;
} ;


/**
 *
 */
Pdp11.prototype._handleTrapAndInterrupt = function( ) {

  if( this.psw.getTrap( ) ) {
    if( this.debugFlags[ 'trap' ] )
      __debugView.outputLine( "trap occured. " + format( this.trap_vector ) ) ;
    this.psw.setTrap( false ) ;
    this._switchCurrentMode( this.trap_vector ) ;
    this.trap_vector = 0 ;
//  __logger.log( this.dump( ) ) ;
  } else if( this._checkInterrupt( ) ) {
    if( this.debugFlags[ 'interrupt' ] )
      __debugView.outputLine( "interrupt occured. " + format( this.interrupt_vector ) ) ;
    this._switchCurrentMode( this.interrupt_vector ) ;
    this.interrupt_vector = 0 ;
    this.interrupt_level = 0 ;
    this.wait = false ;
//    __logger.log( this.dump( ) ) ;
  }

} ;


/**
 *
 */
Pdp11.prototype._switchCurrentMode = function( vector ) {
  var tmpPsw = this.psw.readWord( ) ;
  var tmpPc = this._getPc( ).readWord( ) ;
  var tmpMode = this.psw.getCurrentMode( ) ;

  this.psw.setCurrentMode( Psw.KERNEL_MODE ) ;
  this._pushStack( tmpPsw ) ;
  this._pushStack( tmpPc ) ;

  this._getPc( ).writeWord( this.mmu.loadWordByPhysicalAddress( vector ) ) ;
  this.psw.writeWord( this.mmu.loadWordByPhysicalAddress( vector + 2 ) ) ;
  this.psw.setPreviousMode( tmpMode ) ;
} ;


/**
 * TODO: implement.
 */
Pdp11.prototype.loadBootRom = function( buffer ) {
  var uint8 = new Uint8Array( buffer ) ;
  for( var i = 0; i < 512; i++ ) {
    this.memory.storeByte( i, uint8[ i ] ) ;
  }
/*
  for( var i = 0; i < Pdp11._BOOT_ROM_FOR_RK05.length; i++ ) {
    this.memory.storeWord( Pdp11._BOOT_DATA_ADDRESS + i * 2, Pdp11._BOOT_ROM_FOR_RK05[ i ] ) ;
  }
  this._getPc( ).writeWord( Pdp11._BOOT_DATA_ADDRESS + 2 ) ;
*/
} ;


/**
 *
 */
Pdp11.prototype.setBreakPoints = function( breakPoints ) {
  this.breakPoints = breakPoints ;
} ;


/**
 *
 */
Pdp11.prototype._getReg = function( index ) {
  // temporal
  if( index != 6 ) {
    return this.kernelRegs[ index ]
  }
  return this.psw.currentModeIsKernel( )
    ? this.kernelRegs[ index ]
    : this.userRegs[ index ] ;
} ;


/**
 *
 */
Pdp11.prototype._getSp = function( ) {
  return this._getReg( Pdp11._REGISTER_SP ) ;
} ;


/**
 *
 */
Pdp11.prototype._getPc = function( ) {
  return this._getReg( Pdp11._REGISTER_PC ) ;
} ;


/**
 *
 */
Pdp11.prototype._fetch = function( ) {
  var data = this.mmu.loadWord( this._getPc( ).readWord( ) ) ;
  this._nextStep( ) ;
  return data ;
} ;


/**
 *
 */
Pdp11.prototype._nextStep = function( ) {
  this._getPc( ).incrementWord( ) ;
} ;


/**
 *
 */
Pdp11.prototype._decode = function( code ) {
  // double operand
  if( code & 0170000 ) {
    switch( code & 0170000 ) {
      case 0010000:
        return DoubleOperandInstructions[ 'mov' ] ;
      case 0110000:
        return DoubleOperandInstructions[ 'movb' ] ;
      case 0020000:
        return DoubleOperandInstructions[ 'cmp' ] ;
      case 0120000:
        return DoubleOperandInstructions[ 'cmpb' ] ;
      case 0030000:
        return DoubleOperandInstructions[ 'bit' ] ;
      case 0130000:
        return DoubleOperandInstructions[ 'bitb' ] ;
      case 0040000:
        return DoubleOperandInstructions[ 'bic' ] ;
      case 0140000:
        return DoubleOperandInstructions[ 'bicb' ] ;
      case 0050000:
        return DoubleOperandInstructions[ 'bis' ] ;
      case 0150000:
        return DoubleOperandInstructions[ 'bisb' ] ;
      case 0060000:
        return DoubleOperandInstructions[ 'add' ] ;
      case 0160000:
        return DoubleOperandInstructions[ 'sub' ] ;
    }
  }

  // one half operand
  if( code & 0177000 ) {
    switch( code & 0177000 ) {
      case 0070000:
        return OneHalfOperandInstructions[ 'mul' ] ;
      case 0071000:
        return OneHalfOperandInstructions[ 'div' ] ;
      case 0072000:
        return OneHalfOperandInstructions[ 'ash' ] ;
      case 0073000:
        return OneHalfOperandInstructions[ 'ashc' ] ;
      case 0074000:
        return OneHalfOperandInstructions[ 'xor' ] ;
      case 0075000:
        return OneHalfOperandInstructions[ 'xxx' ] ;
      case 0076000:
        return OneHalfOperandInstructions[ 'xxx' ] ;
      case 0077000:
        return OneHalfOperandInstructions[ 'sob' ] ;
    }
  }

  // single operand
  if( code & 0177700 ) {
    switch( code & 0177700 ) {
      case 0000300:
        return SingleOperandInstructions[ 'swab' ] ;
      case 0005000:
        return SingleOperandInstructions[ 'clr' ] ;
      case 0105000:
        return SingleOperandInstructions[ 'clrb' ] ;
      case 0005100:
        return SingleOperandInstructions[ 'com' ] ;
      case 0105100:
        return SingleOperandInstructions[ 'comb' ] ;
      case 0005200:
        return SingleOperandInstructions[ 'inc' ] ;
      case 0105200:
        return SingleOperandInstructions[ 'incb' ] ;
      case 0005300:
        return SingleOperandInstructions[ 'dec' ] ;
      case 0105300:
        return SingleOperandInstructions[ 'decb' ] ;
      case 0005400:
        return SingleOperandInstructions[ 'neg' ] ;
      case 0105400:
        return SingleOperandInstructions[ 'negb' ] ;
      case 0005500:
        return SingleOperandInstructions[ 'adc' ] ;
      case 0105500:
        return SingleOperandInstructions[ 'adcb' ] ;
      case 0005600:
        return SingleOperandInstructions[ 'sbc' ] ;
      case 0105600:
        return SingleOperandInstructions[ 'sbcb' ] ;
      case 0005700:
        return SingleOperandInstructions[ 'tst' ] ;
      case 0105700:
        return SingleOperandInstructions[ 'tstb' ] ;
      case 0006000:
        return SingleOperandInstructions[ 'ror' ] ;
      case 0106000:
        return SingleOperandInstructions[ 'rorb' ] ;
      case 0006100:
        return SingleOperandInstructions[ 'rol' ] ;
      case 0106100:
        return SingleOperandInstructions[ 'rolb' ] ;
      case 0006200:
        return SingleOperandInstructions[ 'asr' ] ;
      case 0106200:
        return SingleOperandInstructions[ 'asrb' ] ;
      case 0006300:
        return SingleOperandInstructions[ 'asl' ] ;
      case 0106300:
        return SingleOperandInstructions[ 'aslb' ] ;
      case 0006400:
        return SingleOperandInstructions[ 'mark' ] ;
      case 0106400:
        return SingleOperandInstructions[ 'mtps' ] ;
      case 0006500:
        return SingleOperandInstructions[ 'mfpi' ] ;
      case 0106500:
        return SingleOperandInstructions[ 'mfpd' ] ;
      case 0006600:
        return SingleOperandInstructions[ 'mtpi' ] ;
      case 0106600:
        return SingleOperandInstructions[ 'mtpd' ] ;
      case 0006700:
        return SingleOperandInstructions[ 'sxt' ] ;
      case 0106700:
        return SingleOperandInstructions[ 'mfps' ] ;
    }
  }

  // branch instructions
  if( code & 0177400 ) {
    switch( code & 0177400 ) {
      case 0000400:
        return BranchInstructions[ 'br' ] ;
      case 0001000:
        return BranchInstructions[ 'bne' ] ;
      case 0001400:
        return BranchInstructions[ 'beq' ] ;
      case 0002000:
        return BranchInstructions[ 'bge' ] ;
      case 0002400:
        return BranchInstructions[ 'blt' ] ;
      case 0003000:
        return BranchInstructions[ 'bgt' ] ;
      case 0003400:
        return BranchInstructions[ 'ble' ] ;
      case 0100000:
        return BranchInstructions[ 'bpl' ] ;
      case 0100400:
        return BranchInstructions[ 'bmi' ] ;
      case 0101000:
        return BranchInstructions[ 'bhi' ] ;
      case 0101400:
        return BranchInstructions[ 'blos' ] ;
      case 0102000:
        return BranchInstructions[ 'bvc' ] ;
      case 0102400:
        return BranchInstructions[ 'bvs' ] ;
      case 0103000:
        return BranchInstructions[ 'bcc' ] ;
      case 0103400:
        return BranchInstructions[ 'bcs' ] ;
    }
  }

  // TODO: optimize
  for( var i = 0; i < OpCode.length; i++ ) {
    if( ( code & OpCode[ i ].judge ) == OpCode[ i ].value ) {
      return OpCode[ i ] ;
    }
  }

  // TODO: should throw exception?
  return null ;

} ;


/**
 *
 */
Pdp11.prototype._asyncCall = function( func ) {
/*
  var script = document.createElement( 'script' ) ;
  script.onload = function( ) {
    document.body.removeChild( script ) ;
    func( ) ;
  }
  script.src = 'data:text/javascript,' ;
  document.body.appendChild( script ) ;
*/
  var img = new Image ;
  img.addEventListener( 'error', func, false ) ;
  img.src = '' ;
/*
  setTimeout( func, 0 ) ;
*/
} ;


/**
 *
 */
// TODO: move to appropriate class.
Pdp11.prototype._dumpLog = function( ) {
  flushLog( ) ;
/*
  if( __logger.getUrl ) {
    var view = document.getElementById( 'traceLogSpan' ) ;
    while( view.firstChild )
      view.removeChild( view.firstChild )

    var a = document.createElement( 'a' ) ;
    a.download = 'log' ;
    a.href = __logger.getUrl( ) ;
    a.textContent = 'log' ;
    view.appendChild( a ) ;
//    open( __logger.getUrl( ), false ) ;
  }
*/
}


/**
 * TODO: separate BYTE WIDTH one and WORD WIDTH one?
 */
Pdp11.prototype._calculateOperandAddress = function( num, width ) {

  var reg_num = num & 07 ;
  var reg     = this._getReg( reg_num ) ;
  var mode    = ( num & 070 ) >> 3 ;

  // TODO: separate general one and pc one?
  // TODO: what happen when address overflow happen?
  switch( mode ) {

    // TODO: throw Exception or mapped address of register?
    // General and PC : Register contains operand.
    case 0:
      return reg_num ;

    // General and PC : Register contains address.
    case 1:
      return reg.readWord( ) ;

    // General : Register contains address, then increments.
    // PC      : the next word of PC is operand.
    case 2:
      // TODO: throw Exception?
      if( reg_num == 7 ) {
        // throw Exception
      }
      var value = reg.readWord( ) ;
      if( width == Pdp11._WIDTH_BYTE && reg_num < 6 ) // correct?
        reg.incrementByte( ) ;
      else
        reg.incrementWord( ) ;
      return value ;

    // General : Register contains address of address, then increments by 2.
    // PC      : the next word of PC is address
    case 3:
      if( reg_num == 7 ) {
        return this._fetch( ) ;
      }
      var value = this.mmu.loadWord( reg.readWord( ) ) ;
      reg.incrementWord( ) ;
      return value ;

    // General and PC : Register decrements, then contains address.
    case 4:
      if( width == Pdp11._WIDTH_BYTE && reg_num < 6 ) // correct?
        reg.decrementByte( ) ;
      else
        reg.decrementWord( ) ;
      return reg.readWord( ) ;

    // General and PC : Register decrements by 2, then contains address of address.
    case 5:
      reg.decrementWord( ) ;
      return this.mmu.loadWord( reg.readWord( ) ) ;

    // General : The value of register plus next word of PC is adress.
    // PC      : The sum of next two words of PC is address?
    case 6:
      if( reg_num == 7 ) {
         return this._fetch( ) + this._getPc( ).readWord( ) ;
      }
      return reg.readWord( ) + this._fetch( ) ;

    // General : The value of register plus next word of PC is adress of address.
    // PC      : The sum of next two words of PC is address of address?
    case 7:
      if( reg_num == 7 ) {
         return this.mmu.loadWord( this._fetch( ) + this._getPc( ).readWord( ) ) ;
      }
      return this.mmu.loadWord( reg.readWord( ) + this._fetch( ) ) ;

    // unnecessary?
    default:
      break ;

  }

} ;


/**
 *
 */
Pdp11.prototype._load = function( num, width ) {

  var reg_num = num & 07 ;
  var reg     = this._getReg( reg_num ) ;
  var mode    = ( num & 070 ) >> 3 ;

  switch( mode ) {

    case 0:
      return width == Pdp11._WIDTH_BYTE
               ? reg.readLowByte( )
               : reg.readWord( ) ;

    case 2:
      if( reg_num == 7 ) {
        return width == Pdp11._WIDTH_BYTE
                 ? to_uint8( this._fetch( ) ) // this._fetch( ) & 0xff is also ok?
                 : this._fetch( ) ;
      }

    case 1:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
      var addr = this._calculateOperandAddress( num, width ) ;
      return width == Pdp11._WIDTH_BYTE
               ? this.mmu.loadByte( addr )
               : this.mmu.loadWord( addr ) ;

    // unnecessary?
    default:
      break ;

  }

} ;


/**
 *
 */
Pdp11.prototype._store = function( num, width, value ) {

  var reg_num = num & 07 ;
  var reg     = this._getReg( reg_num ) ;
  var mode    = ( num & 070 ) >> 3 ;

  switch( mode ) {

    case 0:
      if( width == Pdp11._WIDTH_BYTE )
        reg.writeLowByte( value ) ;
      else
        reg.writeWord( value ) ;
      break ;

    case 2:
      // TODO: confirm this logic correnspods to the specification or not.
      if( reg_num == 7 ) {
        // throw Exception
        break ;
      }

    case 1:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
      var addr = this._calculateOperandAddress( num, width ) ;
      if( width == Pdp11._WIDTH_BYTE )
        this.mmu.storeByte( addr, value ) ;
      else
        this.mmu.storeWord( addr, value ) ;
      break ;

    // unnecessary?
    default:
      break ;

  }

} ;


/**
 * @param func 
 */
Pdp11.prototype._loadAndStore = function( num, width, value, func ) {

  // TODO: throw Exception if invalid mode is passed?
  var reg_num = num & 07 ;
  var reg     = this._getReg( reg_num ) ;
  var mode    = ( num & 070 ) >> 3 ;

  // TODO: confirm the logic
  switch( mode ) {

    case 0:
      if( width == Pdp11._WIDTH_BYTE )
        reg.writeLowByte( func( reg.readLowByte( ), value, this ) ) ;
      else
        reg.writeWord( func( reg.readWord( ), value, this ) ) ;
      break ;

    case 2:
      // TODO: confirm this logic correnspods to the specification or not.
      if( reg_num == 7 ) {
        // throw Exception
        break ;
      }

    case 1:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
      var addr = this._calculateOperandAddress( num, width ) ;
      if( width == Pdp11._WIDTH_BYTE )
        this.mmu.storeByte( addr, func( this.mmu.loadByte( addr ), value, this ) ) ;
      else
        this.mmu.storeWord( addr, func( this.mmu.loadWord( addr ), value, this ) ) ;
      break ;

    // unnecessary?
    default:
      break ;

  }

} ;


/**
 *
 */
Pdp11.prototype._isNegative = function( val, width ) {
  if( width == Pdp11._WIDTH_WORD && ( val & 0x8000 ) )
    return true ;
  if( width == Pdp11._WIDTH_BYTE && ( val & 0x80 ) )
    return true ;
  return false ;
} ;


/**
 *
 */
Pdp11.prototype._isZero = function( val, width ) {
  if( width == Pdp11._WIDTH_WORD && ( val & 0xffff ) == 0 )
    return true ;
  if( width == Pdp11._WIDTH_BYTE && ( val & 0xff ) == 0 )
    return true ;
  return false ;
} ;


/**
 *
 */
Pdp11.prototype._pushStack = function( val ) {
  this._getSp( ).decrementWord( ) ;
  this.mmu.storeWord( this._getSp( ).readWord( ), val ) ;
} ;


/**
 *
 */
Pdp11.prototype._popStack = function( ) {
  var val = this.mmu.loadWord( this._getSp( ).readWord( ) ) ;
  this._getSp( ).incrementWord( ) ;
  return val ;
} ;


/**
 *
 */
// not implemented yet.
Pdp11.prototype.interrupt = function( level, vector ) {
  this.br[ level ].push( { 'level' : level, 'vector' : vector } ) ;
} ;


/**
 * TODO: optimize
 */
Pdp11.prototype._checkInterrupt = function( ) {
  for( var i = 7; i >= 0; i-- ) {
    if( i <= this.psw.getPriority( ) )
      break ;
    if( this.br[ i ].length > 0 ) {
      var interrupt = this.br[ i ].shift( ) ;
      this.interrupt_level = interrupt.level ;
      this.interrupt_vector = interrupt.vector ;
      return true ;
    }
  }
  return false ;
} ;


/**
 * TODO: optimize
 */
Pdp11.prototype.trap = function( vector ) {
  this.trap_vector = vector ;
  this.psw.setTrap( true ) ;
} ;


/**
 *
 */
var OpType = {
  I_DOUBLE:    0x01,
  I_SINGLE:    0x02,
  I_BRANCH:    0x04,
  I_CONDITION: 0x08,
  I_JSR:       0x10,
  I_RTS:       0x11,
  I_JMP:       0x12,
  I_OTHER:     0x14,
  I_SYSTEM:    0x18,
  I_ONEHALF:   0x20,
} ;


/**
 * TODO: optimize
 */
var DoubleOperandInstructions = {
  'mov' :
  { judge : 0170000, value : 0010000, op : 'mov',   type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      OpHandler.mov( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'movb' :
  { judge : 0170000, value : 0110000, op : 'movb',  type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      OpHandler.mov( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'cmp' :
  { judge : 0170000, value : 0020000, op : 'cmp',   type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      OpHandler.cmp( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'cmpb' :
  { judge : 0170000, value : 0120000, op : 'cmpb',  type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      OpHandler.cmp( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'bit' :
  { judge : 0170000, value : 0030000, op : 'bit',   type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      OpHandler.bit( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'bitb' :
  { judge : 0170000, value : 0130000, op : 'bitb',  type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      OpHandler.bit( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'bic' :
  { judge : 0170000, value : 0040000, op : 'bic',   type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      OpHandler.bic( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'bicb' :
  { judge : 0170000, value : 0140000, op : 'bicb',  type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      OpHandler.bic( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'bis' :
  { judge : 0170000, value : 0050000, op : 'bis',   type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      OpHandler.bis( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'bisb' :
  { judge : 0170000, value : 0150000, op : 'bisb',  type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      OpHandler.bis( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  // TODO: confirm
  'add' :
  { judge : 0170000, value : 0060000, op : 'add',   type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      var src = pdp11._load( ( code & 0007700 ) >> 6, Pdp11._WIDTH_WORD ) ;
      pdp11._loadAndStore( code & 0000077, Pdp11._WIDTH_WORD, src,
        function( arg1, arg2, pdp11 ) {
          var result = arg1 + arg2 ;
          pdp11.psw.setN( pdp11._isNegative( result, Pdp11._WIDTH_WORD ) ) ;
          pdp11.psw.setZ( pdp11._isZero( result, Pdp11._WIDTH_WORD ) ) ;
          pdp11.psw.setV( ( ( ( ~arg1 ^ arg2 ) & ( arg2 ^ result ) ) >> 15 ) & 1 ) ;
          pdp11.psw.setC( result > 0xffff ) ;
          return result ;
        } ) ;
  } },
  // TODO: implement
  'sub' :
  { judge : 0170000, value : 0160000, op : 'sub',   type : OpType.I_DOUBLE,
    run : function( pdp11, code ) {
      var src = pdp11._load( ( code & 0007700 ) >> 6, Pdp11._WIDTH_WORD ) ;
      pdp11._loadAndStore( code & 0000077, Pdp11._WIDTH_WORD, src,
        function( arg1, arg2, pdp11 ) {
          var result = arg1 + ( ~arg2 & 0xffff ) + 1 ;
          pdp11.psw.setN( pdp11._isNegative( result, Pdp11._WIDTH_WORD ) ) ;
          pdp11.psw.setZ( pdp11._isZero( result, Pdp11._WIDTH_WORD ) ) ;
          pdp11.psw.setV( ( ( ( arg1 ^ arg2 ) & ( ~arg2 ^ result ) ) >> 15 ) & 1 ) ;
          pdp11.psw.setC( ( result & 0x10000 ) == 0 ? true : false ) ;
          return result ;
        } ) ;
  } }
} ;

/**
 * TODO: optimize
 */
var OneHalfOperandInstructions = {
  // TODO: confirm
  'mul' :
  { judge : 0177000, value : 0070000, op : 'mul',   type : OpType.I_ONEHALF,
    run : function( pdp11, code ) {
      var reg = ( code & 0000700 ) >> 6 ;
      var src = pdp11._load( code & 0000077, Pdp11._WIDTH_WORD ) ;
      var result = pdp11._getReg( reg ).readWord( ) * src ;

      if( reg & 1 == 0 ) {
        pdp11._getReg( reg + 0 ).writeWord( ( result & 0xffff0000 ) >> 8 ) ;
        pdp11._getReg( reg + 1 ).writeWord( result & 0xffff ) ;
      } else {
        // TODO:confirm
        pdp11._getReg( reg + 0 ).writeWord( result & 0xffff ) ;
      }
      pdp11.psw.setN( result & 0x80000000 ) ;
      pdp11.psw.setZ( ( result & 0xffffffff ) == 0 ) ;
      pdp11.psw.setV( false ) ;
      // TODO:confirm
      pdp11.psw.setC( result < ( 1 << 15 ) || result >= ( ( 1 << 15 ) - 1 ) ) ;
  } },
  // TODO: confirm
  'div' :
  { judge : 0177000, value : 0071000, op : 'div',   type : OpType.I_ONEHALF,
    run : function( pdp11, code ) {
      var reg = ( code & 0000700 ) >> 6 ;
      var src = pdp11._load( code & 0000077, Pdp11._WIDTH_WORD ) ;
      var value = (
                    ( pdp11._getReg( reg + 0 ).readWord( ) << 16 ) |
                    ( pdp11._getReg( reg + 1 ).readWord( ) )
                  ) & 0xffffffff ;
      var quotient = parseInt( value / src ) & 0xffff ;
      var remainder = ( value % src ) & 0xffff ;
      pdp11._getReg( reg + 0 ).writeWord( quotient ) ;
      pdp11._getReg( reg + 1 ).writeWord( remainder ) ;
      pdp11.psw.setN( pdp11._isNegative( quotient, Pdp11._WIDTH_WORD ) ) ;
      pdp11.psw.setZ( pdp11._isZero( quotient, Pdp11._WIDTH_WORD ) ) ;
      pdp11.psw.setV( src == 0 || value > src ) ; // confirm
      pdp11.psw.setC( src == 0 ) ; // confirm
  } },
  // TODO: confirm
  'ash' :
  { judge : 0177000, value : 0072000, op : 'ash',   type : OpType.I_ONEHALF,
    run : function( pdp11, code ) {
      var reg_num = ( code & 0000700 ) >> 6 ;
      var reg = pdp11._getReg( reg_num ) ;
      var src = pdp11._load( code & 0000077, Pdp11._WIDTH_WORD ) ;
      var sign = ( src >> 5 ) & 1 ;
      src = src & 0x1f ;

      if( sign ) {
        src = to_int16( src | 0xffe0 ) * -1 ;
        result = to_int16( reg.readWord( ) ) >> src ;
        pdp11.psw.setN( pdp11._isNegative( result, Pdp11._WIDTH_WORD ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, Pdp11._WIDTH_WORD) ) ;
        pdp11.psw.setV( ( result ^ reg.readWord( ) ) & 0x8000 ) ;
        pdp11.psw.setC( ( to_int16( reg.readWord( ) ) >> ( src - 1 ) ) & 1 ) ;
        reg.writeWord( result ) ;
      } else {
        result = reg.readWord( ) << src ;
        pdp11.psw.setN( pdp11._isNegative( result, Pdp11._WIDTH_WORD ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, Pdp11._WIDTH_WORD) ) ;
        pdp11.psw.setV( ( result ^ reg.readWord( ) ) & 0x8000 ) ;
        pdp11.psw.setC( result & 0x10000 ) ;
        reg.writeWord( result ) ;
      }
  } },
  // TODO: confirm
  'ashc' :
  { judge : 0177000, value : 0073000, op : 'ashc',  type : OpType.I_ONEHALF,
    run : function( pdp11, code ) {
      var reg_num = ( code & 0000700 ) >> 6 ;
      var reg = pdp11._getReg( reg_num ) ;
      var src = pdp11._load( code & 0000077, Pdp11._WIDTH_WORD ) ;
      var sign = ( src >> 5 ) & 1 ;
      src = src & 0x1f ;
      var value = ( ( pdp11._getReg( reg_num + 0 ).readWord( ) << 16 ) |
                    pdp11._getReg( reg_num + 1 ).readWord( ) ) & 0xffffffff ;

      if( sign ) {
        src = to_int16( src | 0xffe0 ) * -1 ;
        result = to_int32( value ) >> src ;
        pdp11.psw.setN( result & 0x80000000 ) ;
        pdp11.psw.setZ( ( result & 0xffffffff ) == 0 ) ;
        pdp11.psw.setV( ( result ^ value ) & 0x80000000 ) ;
        pdp11.psw.setC( ( to_int32( value ) >> ( src - 1 ) ) & 1 ) ;
        pdp11._getReg( reg_num + 0 ).writeWord( ( result & 0xffff0000 ) >> 16 ) ;
        pdp11._getReg( reg_num + 1 ).writeWord( result & 0xffff ) ;
      } else {
        result = value << src ;
        pdp11.psw.setN( result & 0x80000000 ) ;
        pdp11.psw.setZ( ( result & 0xffffffff ) == 0 ) ;
        pdp11.psw.setV( ( result ^ value ) & 0x80000000 ) ;
        pdp11.psw.setC( ( value >> ( 32 - src ) ) & 1 ) ;
        pdp11._getReg( reg_num + 0 ).writeWord( ( result & 0xffff0000 ) >> 16 ) ;
        pdp11._getReg( reg_num + 1 ).writeWord( result & 0xffff ) ;
      }
  } },
  // TODO: confirm
  'xor' :
  { judge : 0177000, value : 0074000, op : 'xor',   type : OpType.I_ONEHALF,
    run : function( pdp11, code ) {
      var src = pdp11._getReg( ( code & 0000700 ) >> 6 ).readWord( ) ;
      pdp11._loadAndStore( code & 0000077, Pdp11._WIDTH_WORD, src,
        function( arg1, arg2, pdp11 ) {
          var result = arg1 ^ arg2 ;
          pdp11.psw.setN( pdp11._isNegative( result, Pdp11._WIDTH_WORD ) ) ;
          pdp11.psw.setZ( pdp11._isZero( result, Pdp11._WIDTH_WORD ) ) ;
          pdp11.psw.setV( false ) ;
          return result ;
        } ) ;
  } },
  'xxx' :
  { judge : 0177000, value : 0075000, op : 'xxx',   type : OpType.I_ONEHALF },
  'xxx' :
  { judge : 0177000, value : 0076000, op : 'xxx',   type : OpType.I_ONEHALF },
  // TODO: confirm
  'sob' :
  { judge : 0177000, value : 0077000, op : 'sob',   type : OpType.I_ONEHALF,
    run : function( pdp11, code ) {
      var reg_num = ( code & 0000700 ) >> 6 ;
//      var addr = pdp11._load( reg_num, Pdp11._WIDTH_WORD ) ;
      var reg = pdp11._getReg( reg_num ) ;
      var pc  = pdp11._getPc( ) ;
      var des = code & 0000077 ;
      reg.decrementByte( ) ;
      if( reg.readWord( ) ) {
        pc.writeWord( pc.readWord( ) - ( des * 2 ) ) ;
      }
  } }
} ;


/**
 * TODO: optimize
 */
var SingleOperandInstructions = {
  'swab' :
  { judge : 0177700, value : 0000300, op : 'swab',  type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      var des = code & 077 ;
      if( ! ( des & 070 ) ) {
        var src = pdp11._getReg( des & 07 ).readWord( ) ;
        result = ( ( src & 0xff ) << 8 ) | ( ( src & 0xff00 ) >> 8 ) ;
        pdp11._getReg( des & 07 ).writeWord( result ) ;
        pdp11.psw.setN( ( result & 0x80 ) ) ; // correct?
        pdp11.psw.setZ( ( result & 0xff ) == 0 ) ; // correct?
        pdp11.psw.setV( false ) ;
        pdp11.psw.setC( false ) ;
      } else {
        pdp11._loadAndStore( code & 0000077, Pdp11._WIDTH_WORD, 0,
          function( arg1, arg2, pdp11 ) {
            var result = ( ( arg1 & 0xff ) << 8 ) | ( ( arg1 & 0xff00 ) >> 8 ) ;
            pdp11.psw.setN( ( result & 0x80 ) ) ; // correct?
            pdp11.psw.setZ( ( result & 0xff ) == 0 ) ; // correct?
            pdp11.psw.setV( false ) ;
            pdp11.psw.setC( false ) ;
            return result ;
          } ) ;
      }
  } },
//   'bpl' :
//  { judge : 0177700, value : 0100300, op : 'bpl',   type : OpType.I_SINGLE },
  'clr' :
  { judge : 0177700, value : 0005000, op : 'clr',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.clr( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'clrb' :
  { judge : 0177700, value : 0105000, op : 'clrb',  type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.clr( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'com' :
  { judge : 0177700, value : 0005100, op : 'com',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.com( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'comb' :
  { judge : 0177700, value : 0105100, op : 'comb',  type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.com( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'inc' :
  { judge : 0177700, value : 0005200, op : 'inc',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.inc( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'incb' :
  { judge : 0177700, value : 0105200, op : 'incb',  type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.inc( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'dec' :
  { judge : 0177700, value : 0005300, op : 'dec',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.dec( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'decb' :
  { judge : 0177700, value : 0105300, op : 'decb',  type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.dec( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'neg' :
  { judge : 0177700, value : 0005400, op : 'neg',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.neg( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'negb' :
  { judge : 0177700, value : 0105400, op : 'negb',  type : OpType.I_SINGLE,
    run : function( pdp11, proc, code, ahead ) {
      OpHandler.neg( pdp11, proc, code, ahead, Processor.BYTE ) ;
  } },
  'adc' :
  { judge : 0177700, value : 0005500, op : 'adc',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.adc( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'adcb' :
  { judge : 0177700, value : 0105500, op : 'adcb',  type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.adc( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'sbc' :
  { judge : 0177700, value : 0005600, op : 'sbc',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.sbc( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'sbcb' :
  { judge : 0177700, value : 0105600, op : 'sbcb',  type : OpType.I_SINGLE,
    run : function( pdp11, proc, code, ahead ) {
      OpHandler.sbc( pdp11, proc, code, ahead, Processor.BYTE ) ;
  } },
  'tst' :
  { judge : 0177700, value : 0005700, op : 'tst',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.tst( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'tstb' :
  { judge : 0177700, value : 0105700, op : 'tstb',  type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.tst( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'ror' :
  { judge : 0177700, value : 0006000, op : 'ror',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.ror( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'rorb' :
  { judge : 0177700, value : 0106000, op : 'rorb',  type : OpType.I_SINGLE },
  'rol' :
  { judge : 0177700, value : 0006100, op : 'rol',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.rol( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'rolb' :
  { judge : 0177700, value : 0106100, op : 'rolb',  type : OpType.I_SINGLE },
  'asr' :
  { judge : 0177700, value : 0006200, op : 'asr',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.asr( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'asrb' :
  { judge : 0177700, value : 0106200, op : 'asrb',  type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.asr( pdp11, code, Pdp11._WIDTH_BYTE ) ;
  } },
  'asl' :
  { judge : 0177700, value : 0006300, op : 'asl',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      OpHandler.asl( pdp11, code, Pdp11._WIDTH_WORD ) ;
  } },
  'aslb' :
  { judge : 0177700, value : 0106300, op : 'aslb',  type : OpType.I_SINGLE },
  'mark' :
  { judge : 0177700, value : 0006400, op : 'mark',  type : OpType.I_SINGLE },
  'mtps' :
  { judge : 0177700, value : 0106400, op : 'mtps',  type : OpType.I_SINGLE },
  // TODO: implement
  'mfpi' :
  { judge : 0177700, value : 0006500, op : 'mfpi',  type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      try {
        var result ;
        if( ( code & 070 ) == 0 ) {
          var reg_num = code & 07 ;
          if( pdp11.psw.previousModeIsKernel( ) ) {
            result = pdp11.kernelRegs[ reg_num ].readWord( ) ;
          } else {
            result = pdp11.userRegs[ reg_num ].readWord( ) ;
          }
        } else {
          var src = pdp11._calculateOperandAddress( code & 0000077, Pdp11._WIDTH_WORD ) ;
          result = pdp11.mmu.loadWordFromPreviousUserSpace( src ) ;
        }
        pdp11._pushStack( result ) ;
        pdp11.psw.setN( pdp11._isNegative( result, Pdp11._WIDTH_WORD ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, Pdp11._WIDTH_WORD ) ) ;
        pdp11.psw.setV( false ) ;
      // TODO: check Exception type.
      } catch( e ) {
        if( e.name == 'Error' ) {
          __logger.log( e.stack ) ;
          pdp11.trap( 004 ) ;
        } else {
          throw e ;
        }
      }
  } },
  'mfpd' :
  { judge : 0177700, value : 0106500, op : 'mfpd',  type : OpType.I_SINGLE },
  'mtpi' :
  { judge : 0177700, value : 0006600, op : 'mtpi',  type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      var result ;
      if( ( code & 070 ) == 0 ) {
        var reg_num = code & 07 ;
        result = pdp11._popStack( ) ;
        if( pdp11.psw.previousModeIsKernel( ) ) {
          pdp11.kernelRegs[ reg_num ].writeWord( result ) ;
        } else {
          pdp11.userRegs[ reg_num ].writeWord( result ) ;
        }
      } else {
        var src = pdp11._calculateOperandAddress( code & 0000077, Pdp11._WIDTH_WORD ) ;
        result = pdp11._popStack( ) ;
        pdp11.mmu.storeWordIntoPreviousUserSpace( src, result ) ;
      }
      pdp11.psw.setN( pdp11._isNegative( result, Pdp11._WIDTH_WORD ) ) ;
      pdp11.psw.setZ( pdp11._isZero( result, Pdp11._WIDTH_WORD ) ) ;
      pdp11.psw.setV( false ) ;
  } },
  'mtpd' :
  { judge : 0177700, value : 0106600, op : 'mtpd',  type : OpType.I_SINGLE },
  'sxt' :
  { judge : 0177700, value : 0006700, op : 'sxt',   type : OpType.I_SINGLE,
    run : function( pdp11, code ) {
      var result = pdp11.psw.getN( ) ? 0xffff : 0x0000 ;
      pdp11._store( code & 0000077, Pdp11._WIDTH_WORD, result ) ;
      pdp11.psw.setZ( ! pdp11.psw.getN( ) ) ;
      pdp11.psw.setV( false ) ;
  } },
  'mfps' :
  { judge : 0177700, value : 0106700, op : 'mfps',  type : OpType.I_SINGLE }
} ;


/**
 * TODO: optimize
 */
var BranchInstructions = {
  'br' :
  { judge : 0177400, value : 0000400, op : 'br',    type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      OpHandler.br( pdp11, code ) ;
  } },
  'bne' :
  { judge : 0177400, value : 0001000, op : 'bne',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( ! pdp11.psw.getZ( ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'beq' :
  { judge : 0177400, value : 0001400, op : 'beq',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( pdp11.psw.getZ( ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'bge' :
  { judge : 0177400, value : 0002000, op : 'bge',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( ( pdp11.psw.getN( ) ^ pdp11.psw.getV( ) ) == 0 )
        OpHandler.br( pdp11, code ) ;
  } },
  'blt' :
  { judge : 0177400, value : 0002400, op : 'blt',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( pdp11.psw.getN( ) ^ pdp11.psw.getV( ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'bgt' :
  { judge : 0177400, value : 0003000, op : 'bgt',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( ! ( pdp11.psw.getZ( ) || ( pdp11.psw.getN( ) ^ pdp11.psw.getV( ) ) ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'ble' :
  { judge : 0177400, value : 0003400, op : 'ble',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( ( pdp11.psw.getZ( ) || ( pdp11.psw.getN( ) ^ pdp11.psw.getV( ) ) ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'bpl' :
  { judge : 0177400, value : 0100000, op : 'bpl',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( ! pdp11.psw.getN( ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'bmi' :
  { judge : 0177400, value : 0100400, op : 'bmi',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( pdp11.psw.getN( ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'bhi' :
  { judge : 0177400, value : 0101000, op : 'bhi',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( ! pdp11.psw.getC( ) && ! pdp11.psw.getZ( ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'blos' :
  { judge : 0177400, value : 0101400, op : 'blos',  type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( pdp11.psw.getC( ) ^ pdp11.psw.getZ( ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'bvc' :
  { judge : 0177400, value : 0102000, op : 'bvc',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( ! pdp11.psw.getV( ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'bvs' :
  { judge : 0177400, value : 0102400, op : 'bvs',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( pdp11.psw.getV( ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'bcc' :
  { judge : 0177400, value : 0103000, op : 'bcc',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( ! pdp11.psw.getC( ) )
        OpHandler.br( pdp11, code ) ;
  } },
  'bcs' :
  { judge : 0177400, value : 0103400, op : 'bcs',   type : OpType.I_BRANCH,
    run : function( pdp11, code ) {
      if( pdp11.psw.getC( ) )
        OpHandler.br( pdp11, code ) ;
  } }
} ;


/**
 * TODO: optimize
 */
var OpCode = [

  { judge : 0177777, value : 0170011, op : 'setd',  type : OpType.I_OTHER,
    run : function( pdp11, proc, code, ahead ) { } },
  { judge : 0177777, value : 0000241, op : 'clc',   type : OpType.I_CONDITION,
    run : function( pdp11, code ) {
      pdp11.psw.setC( false ) ;
  } },
  { judge : 0177777, value : 0000261, op : 'sec',   type : OpType.I_CONDITION,
    run : function( pdp11, code ) {
      pdp11.psw.setC( true ) ;
  } },
  { judge : 0177777, value : 0000242, op : 'clv',   type : OpType.I_CONDITION,
    run : function( pdp11, code ) {
      pdp11.psw.setV( false ) ;
  } },
  { judge : 0177777, value : 0000262, op : 'sev',   type : OpType.I_CONDITION,
    run : function( pdp11, code ) {
      pdp11.psw.setV( true ) ;
  } },
  { judge : 0177777, value : 0000244, op : 'clz',   type : OpType.I_CONDITION,
    run : function( pdp11, code ) {
      pdp11.psw.setZ( false ) ;
  } },
  { judge : 0177777, value : 0000264, op : 'sez',   type : OpType.I_CONDITION,
    run : function( pdp11, code ) {
      pdp11.psw.setZ( true ) ;
  } },
  { judge : 0177777, value : 0000254, op : 'cln',   type : OpType.I_CONDITION,
    run : function( pdp11, code ) {
      pdp11.psw.setN( false ) ;
  } },
  { judge : 0177777, value : 0000274, op : 'sen',   type : OpType.I_CONDITION,
    run : function( pdp11, code ) {
      pdp11.psw.setN( true ) ;
  } },
  { judge : 0177777, value : 0000257, op : 'ccc',   type : OpType.I_CONDITION,
    run : function( pdp11, code ) {
      pdp11.psw.setC( false ) ;
      pdp11.psw.setV( false ) ;
      pdp11.psw.setZ( false ) ;
      pdp11.psw.setN( false ) ;
  } },
  { judge : 0177777, value : 0000277, op : 'scc',   type : OpType.I_CONDITION,
    run : function( pdp11, code ) {
      pdp11.psw.setC( true ) ;
      pdp11.psw.setV( true ) ;
      pdp11.psw.setZ( true ) ;
      pdp11.psw.setN( true ) ;
  } },
  { judge : 0177000, value : 0004000, op : 'jsr',   type : OpType.I_JSR,
    run : function( pdp11, code ) {
      var reg  = pdp11._calculateOperandAddress( ( code & 0000700 ) >> 6, Pdp11._WIDTH_WORD ) ;
      var addr = pdp11._calculateOperandAddress( code & 0000077, Pdp11._WIDTH_WORD ) ;
      pdp11._pushStack( pdp11._getReg( ( code & 0000700 ) >> 6 ).readWord( ) ) ;
      pdp11._getReg( ( code & 0000700 ) >> 6 ).writeWord( pdp11._getPc( ).readWord( ) ) ;
      pdp11._getPc( ).writeWord( addr ) ;
  } },
  { judge : 0177770, value : 0000200, op : 'rts',   type : OpType.I_RTS,
    run : function( pdp11, code ) {
      var reg_num = code & 07 ;
      pdp11._getPc( ).writeWord( pdp11._getReg( reg_num ).readWord( ) ) ;
      pdp11._getReg( reg_num ).writeWord( pdp11._popStack( ) ) ;
  } },
  /**
   * TODO: implement Exception
   */
  { judge : 0177700, value : 0000100, op : 'jmp',   type : OpType.I_JMP,
    run : function( pdp11, code ) {
//      if( ( code & 070 ) == 0 )
//        throw Exception( ) ;
      var addr = pdp11._calculateOperandAddress( code & 0000077, Pdp11._WIDTH_WORD ) ;
      pdp11._getPc( ).writeWord( addr ) ;
  } },
  { judge : 0177777, value : 0000240, op : 'nop',   type : OpType.I_OTHER },
  { judge : 0177777, value : 0000000, op : 'halt',  type : OpType.I_OTHER,
    run : function( pdp11, code, ahead ) {
  } }, // not implemented yet.
  { judge : 0177777, value : 0000001, op : 'wait',  type : OpType.I_OTHER,
    run : function( pdp11, code, ahead ) {
      pdp11.wait = true ;
  } }, // not implemented yet.
  { judge : 0177777, value : 0000002, op : 'rti',   type : OpType.I_OTHER,
    run : function( pdp11, code, ahead ) {
      pdp11.get_reg( 7 ).set_word( pdp11.mmu.load_word( pdp11.get_reg( 6 ).get_word( ) ) ) ;
      pdp11.get_reg( 6 ).increment( ) ;
      pdp11.psw.set_word( pdp11.mmu.load_word( pdp11.get_reg( 6 ).get_word( ) ) ) ;
      pdp11.get_reg( 6 ).increment( ) ;
  } },
  // TODO: implement
  { judge : 0177777, value : 0000006, op : 'rtt',   type : OpType.I_OTHER,
    run : function( pdp11, code ) {
      pdp11._getPc( ).writeWord( pdp11._popStack( ) ) ;
      pdp11.psw.writeWord( pdp11._popStack( ) ) ;
  } },
  { judge : 0177777, value : 0000004, op : 'bpt',   type : OpType.I_OTHER },
  { judge : 0177777, value : 0000005, op : 'reset', type : OpType.I_OTHER,
    run : function( pdp11, code, ahead ) { } }, // not implemented yet.
  { judge : 0177400, value : 0104400, op : 'trap',   type : OpType.I_SYSTEM,
    run : function( pdp11, proc, code, ahead ) {
      pdp11.trap( 034 ) ;
  } },
  { judge : 0000000, value : 0000000, op : '??',    type : OpType.I_OTHER }
] ;


/**
 * TODO: optimize
 */
var OpHandler = {

  mov: function( pdp11, code, width ) {
    var result = pdp11._load( ( code & 0007700 ) >> 6, width ) ;

    // temporal
    if( width == Pdp11._WIDTH_BYTE && ( code & 0000070 ) == 0 ) {
      width = Pdp11._WIDTH_WORD ;
      if( result & 0x80 )
        result |= 0xff00 ;
    }

    pdp11._store( code & 0000077, width, result ) ;
    pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
    pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
    pdp11.psw.setV( false ) ;
  },

  // confirm
  cmp: function( pdp11, code, width ) {
    var src = pdp11._load( ( code & 0007700 ) >> 6, width ) ;
    var dst = pdp11._load( code & 0000077, width ) ;
    var shift = width == Pdp11._WIDTH_WORD ? 15 : 7 ;
    var mask  = width == Pdp11._WIDTH_WORD ?  0xffff :  0xff ;
    var carry = width == Pdp11._WIDTH_WORD ? 0x10000 : 0x100 ;
    var result = src + ( ~dst & mask ) + 1 ;
    pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
    pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
    pdp11.psw.setV( ( ( ( src ^ dst ) & ( ~dst ^ result ) ) >> shift ) & 1 ) ;
    pdp11.psw.setC( ( result & carry ) == 0 ? true : false ) ;
  },

  bit: function( pdp11, code, width ) {
    var src = pdp11._load( ( code & 0007700 ) >> 6, width ) ;
    var dst = pdp11._load( code & 0000077, width ) ;
    var result = src & dst ;
    pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
    pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
    pdp11.psw.setV( false ) ;
  },

  bic: function( pdp11, code, width ) {
    var src = pdp11._load( ( code & 0007700 ) >> 6, width ) ;
    pdp11._loadAndStore( code & 0000077, width, src,
      function( arg1, arg2, pdp11 ) {
        var result = arg1 & ~arg2 ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        pdp11.psw.setV( false ) ;
        return result ;
      } ) ;
  },

  bis: function( pdp11, code, width ) {
    var src = pdp11._load( ( code & 0007700 ) >> 6, width ) ;
    pdp11._loadAndStore( code & 0000077, width, src,
      function( arg1, arg2, pdp11 ) {
        var result = arg1 | arg2 ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        pdp11.psw.setV( false ) ;
        return result ;
      } ) ;
  },

  clr: function( pdp11, code, width ) {
    pdp11._store( code & 0000077, width, 0 ) ;
    pdp11.psw.setN( false ) ;
    pdp11.psw.setZ( true ) ;
    pdp11.psw.setV( false ) ;
    pdp11.psw.setC( false ) ;
  },

  com: function( pdp11, code, width ) {
    pdp11._loadAndStore( code & 0000077, width, 0,
      function( arg1, arg2, pdp11 ) {
        var result = ~arg1 ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        pdp11.psw.setV( false ) ;
        pdp11.psw.setC( true ) ;
        return result ;
      } ) ;
  },

  inc: function( pdp11, code, width ) {
    pdp11._loadAndStore( code & 0000077, width, 1,
      function( arg1, arg2, pdp11 ) {
        var result = arg1 + arg2 ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        if( width == Pdp11._WIDTH_WORD )
          pdp11.psw.setV( arg1 == 0x7fff ) ;
        else
          pdp11.psw.setV( arg1 == 0x7f ) ;
        return result ;
      } ) ;
  },

  dec: function( pdp11, code, width ) {
    pdp11._loadAndStore( code & 0000077, width, 1,
      function( arg1, arg2, pdp11 ) {
        var result = arg1 - arg2 ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        if( width == Pdp11._WIDTH_WORD )
          pdp11.psw.setV( arg1 == 0x8000 ) ;
        else
          pdp11.psw.setV( arg1 == 0x80 ) ;
        return result ;
      } ) ;
  },

  neg: function( pdp11, code, width ) {
    pdp11._loadAndStore( code & 0000077, width, -1,
      function( arg1, arg2, pdp11 ) {
        var result = arg1 * arg2 ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        if( width == Pdp11._WIDTH_WORD )
          pdp11.psw.setV( ( result & 0xffff ) == 0x8000 ) ;
        else
          pdp11.psw.setV( ( result & 0xff ) == 0x80 ) ;
        pdp11.psw.setC( ! pdp11._isZero( result, width ) ) ;
        return result ;
      } ) ;
  },

  adc: function( pdp11, code, width ) {
    var c = pdp11.psw.getC( ) ? 1 : 0 ;
    pdp11._loadAndStore( code & 0000077, width, c,
      function( arg1, arg2, pdp11 ) {
        var result = arg1 + arg2 ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        if( width == Pdp11._WIDTH_WORD ) {
          pdp11.psw.setV( arg1 == 0x7fff && arg2 == 1 ) ;
          pdp11.psw.setC( arg1 == 0xffff && arg2 == 1 ) ;
        } else {
          pdp11.psw.setV( arg1 == 0x7f && arg2 == 1 ) ;
          pdp11.psw.setC( arg1 == 0xff && arg2 == 1 ) ;
        }
        return result ;
      } ) ;
  },

  sbc: function( pdp11, code, width ) {
    var c = pdp11.psw.getC( ) ? 1 : 0 ;
    pdp11._loadAndStore( code & 0000077, width, c,
      function( arg1, arg2, pdp11 ) {
        var result = arg1 - arg2 ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        if( width == Pdp11._WIDTH_WORD )
          pdp11.psw.setV( arg1 == 0x8000 ) ;
        else
          pdp11.psw.setV( arg1 == 0x80 ) ;
        pdp11.psw.setC( arg1 == 0 && arg2 == 1 ) ;
        return result ;
      } ) ;
  },

  tst: function( pdp11, code, width ) {
    var result = pdp11._load( code & 0000077, width ) ;
    pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
    pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
    pdp11.psw.setV( false ) ;
    pdp11.psw.setC( false ) ;
  },

  br: function( pdp11, code ) {
    var des = code & 0377 ;
    pdp11._getPc( ).writeWord( pdp11._getPc( ).readWord( ) + ( to_int8( des ) * 2 ) ) ;
  },

  rol: function( pdp11, code, width ) {
    pdp11._loadAndStore( code & 0000077, width, 0,
      function( arg1, arg2, pdp11 ) {
        if( width == Pdp11._WIDTH_WORD ) {
          result = ( arg1 << 1 ) & 0xffff ;
        } else {
          result = ( arg1 << 1 ) & 0xff ;
        }
        if( pdp11.psw.getC( ) )
          result |= 1 ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        if( width == Pdp11._WIDTH_WORD )
          pdp11.psw.setC( arg1 & 0x8000 ) ;
        else
          pdp11.psw.setC( arg1 & 0x80 ) ;
        pdp11.psw.setV( pdp11.psw.getN( ) ^ pdp11.psw.getC( ) ) ;
        return result ;
      } ) ;
  },

  ror: function( pdp11, code, width ) {
    pdp11._loadAndStore( code & 0000077, width, 0,
      function( arg1, arg2, pdp11 ) {
        if( width == Pdp11._WIDTH_WORD ) {
          result = ( arg1 >> 1 ) & 0xffff ;
          if( pdp11.psw.getC( ) )
            result |= 0x8000 ;
        } else {
          result = ( arg1 >> 1 ) & 0xff ;
          if( pdp11.psw.getC( ) )
            result |= 0x80 ;
        }
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        pdp11.psw.setC( arg1 & 1 ) ;
        pdp11.psw.setV( pdp11.psw.getN( ) ^ pdp11.psw.getC( ) ) ;
        return result ;
      } ) ;
  },

  asr: function( pdp11, code, width ) {
    pdp11._loadAndStore( code & 0000077, width, 0,
      function( arg1, arg2, pdp11 ) {
        var result = ( arg1 >> 1 ) ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        pdp11.psw.setC( arg1 & 1 ) ;
        pdp11.psw.setV( pdp11.psw.getN( ) ^ pdp11.psw.getC( ) ) ;
        return result ;
      } ) ;
  },

  asl: function( pdp11, code, width ) {
    pdp11._loadAndStore( code & 0000077, width, 0,
      function( arg1, arg2, pdp11 ) {
        var result = ( arg1 << 1 ) ;
        pdp11.psw.setN( pdp11._isNegative( result, width ) ) ;
        pdp11.psw.setZ( pdp11._isZero( result, width ) ) ;
        if( width == Pdp11._WIDTH_WORD )
          pdp11.psw.setC( arg1 & 0x8000 ) ;
        else
          pdp11.psw.setC( arg1 & 0x80 ) ;
        pdp11.psw.setV( pdp11.psw.getN( ) ^ pdp11.psw.getC( ) ) ;
        return result ;
      } ) ;
  }
} ;


/**
 *
 */
Pdp11.prototype.dump = function( ) {
  var buffer = this.psw.dump( ) ;
  buffer += ' ' ;
  for( var i = 0; i < Pdp11._NUM_OF_REGISTERS; i++ ) {
    buffer += 'r' + i + ':' + format( this._getReg( i ).readWord( ) ) ;
    buffer += '(' + format( this.mmu.loadWord( this._getReg( i ).readWord( ), true ) ) + ')' ;
    buffer += ', ' ;
  }
  buffer += this.mmu.dump( ) ;
  buffer += this.apr.dump( ) ;
  return buffer ;
} ;


/**
 *
 */
Pdp11.prototype.stackDump = function( ) {
  buffer = '' ;
  for( var i = 0; i < 10; i++ ) {
    if( this._getSp( ).readWord( ) + ( i * 2 ) >= 0x10000 )
      return buffer ;
    buffer += format( this._getSp( ).readWord( ) + ( i * 2 ) ) + ':' +
              format( this.mmu.loadWord( this._getSp( ).readWord( ) + ( i * 2 ), true ) ) + '\n' ;
  }
  return buffer ;
} ;
