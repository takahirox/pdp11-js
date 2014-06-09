/**
 *
 */

__jsimport( "pdp11/Pdp11.js" ) ;
__jsimport( "pdp11/Psw.js" ) ;
__jsimport( "pdp11/Apr.js" ) ;
__jsimport( "pdp11/Memory.js" ) ;
__jsimport( "pdp11/Clock.js" ) ;
__jsimport( "pdp11/Terminal.js" ) ;
__jsimport( "pdp11/Register.js" ) ;

function Mmu( pdp11 ) {
  this.pdp11 = pdp11 ;
  this.psw = null ;
  this.apr = null ;
  this.memory = null ;
  this.clock = null ;
  this.terminal = null ;
  this.disk = null ;
  this.ssr0 = new Register( ) ;
  this.ssr2 = new Register( ) ;
}

Mmu._TRAP_POINT = 0760000 ; // temporal

Mmu.prototype.setPsw = function( psw ) {
  this.psw = psw ;
} ;

Mmu.prototype.setApr = function( apr ) {
  this.apr = apr ;
} ;

Mmu.prototype.setMemory = function( memory ) {
  this.memory = memory ;
} ;

Mmu.prototype.setClock = function( clock ) {
  this.clock = clock ;
} ;

Mmu.prototype.setTerminal = function( terminal ) {
  this.terminal = terminal ;
} ;

Mmu.prototype.setDisk = function( disk ) {
  this.disk = disk ;
} ;

Mmu.prototype._map = function( address ) {
  switch( address ) {
    case 0772300:
    case 0772302:
    case 0772304:
    case 0772306:
    case 0772310:
    case 0772312:
    case 0772314:
    case 0772316:
      return this.apr.kernelPdrs[ ( address - 0772300 ) / 2 ] ;
    case 0772340:
    case 0772342:
    case 0772344:
    case 0772346:
    case 0772350:
    case 0772352:
    case 0772354:
    case 0772356:
      return this.apr.kernelPars[ ( address - 0772340 ) / 2 ] ;
    case 0777400:
      return this.disk.rkds ;
    case 0777402:
      return this.disk.rker ;
    case 0777404:
      return this.disk.rkcs ;
    case 0777406:
      return this.disk.rkwc ;
    case 0777410:
      return this.disk.rkba ;
    case 0777412:
      return this.disk.rkda ;
    case 0777416:
      return this.disk.rkdb ;
    case 0777546:
      return this.clock.register ;
    case 0777560:
      return this.terminal.rsr ;
    case 0777562:
      return this.terminal.rbr ;
    case 0777564:
      return this.terminal.xsr ;
    case 0777566:
      return this.terminal.xbr ;
    case 0777570: // temporal
      var r = new Register( ) ;
      r.writeWord( 0xffffff ) ;
      return r ;
    case 0777572:
      return this.ssr0 ;
    case 0777576:
      return this.ssr2 ;
    case 0777600:
    case 0777602:
    case 0777604:
    case 0777606:
    case 0777610:
    case 0777612:
    case 0777614:
    case 0777616:
      return this.apr.userPdrs[ ( address - 0777600 ) / 2 ] ;
    case 0777640:
    case 0777642:
    case 0777644:
    case 0777646:
    case 0777650:
    case 0777652:
    case 0777654:
    case 0777656:
      return this.apr.userPars[ ( address - 0777640 ) / 2 ] ;
    case 0777776:
      return this.psw ;
    default:
      return new Register( ) ;
      return this.memory ;
  }

} ;

Mmu.prototype.loadWord = function( v_address, prevent ) {
  var p_address = this._convert( v_address, prevent ) ;
  return this.loadWordByPhysicalAddress( p_address ) ;
} ;

Mmu.prototype.loadByte = function( v_address ) {
  var p_address = this._convert( v_address ) ;
  return this.loadByteByPhysicalAddress( p_address ) ;
} ;

Mmu.prototype.storeWord = function( v_address, value ) {
  var p_address = this._convert( v_address ) ;
  this.storeWordByPhysicalAddress( p_address, value ) ;
} ;

Mmu.prototype.storeByte = function( v_address, value ) {
  var p_address = this._convert( v_address ) ;
  this.storeByteByPhysicalAddress( p_address, value ) ;
} ;

/**
 * TODO: implement
 */
Mmu.prototype.storeWordIntoPreviousUserSpace = function( v_address, value ) {
  var tmp = this.psw.getCurrentMode( ) ;
  this.psw.setCurrentMode( this.psw.getPreviousMode( ) ) ;
  var p_address = this._convert( v_address ) ;
  this.psw.setCurrentMode( tmp ) ;
  this.storeWordByPhysicalAddress( p_address, value ) ;
} ;

/**
 * TODO: implement
 */
Mmu.prototype.loadWordFromPreviousUserSpace = function( v_address ) {
  var tmp = this.psw.getCurrentMode( ) ;
  this.psw.setCurrentMode( this.psw.getPreviousMode( ) ) ;
  try {
    var p_address = this._convert( v_address ) ;
  } finally {
    this.psw.setCurrentMode( tmp ) ;
  }
  return this.loadWordByPhysicalAddress( p_address ) ;
} ;

Mmu.prototype._managementIsAvailable = function( ) {
  return ( this.ssr0.readWord( ) & 1 ) ? true : false ;
} ;

/**
 * TODO: throw exception when invalid access happens.
 */
Mmu.prototype._convert = function( v_address, prevent ) {
  v_address &= 0xffff ;
  if( ! this._managementIsAvailable( ) ) {
    if( v_address >= 0160000 && v_address < 0180000 ) {
      return v_address | 0700000 ;
    }
    return v_address ;
  }

  var index = ( v_address >> 13 ) & 0x7 ;
  var base = ( this.apr.getPar( index ).readWord( ) & 0xfff ) << 6 ;
  var offset = v_address & 0x1fff ;
  var blockNum = offset >> 6
  var p_address = base + offset;
  if( prevent )
    return p_address ;

  var length = this.apr.getPdr( index ).readPartial( 8, 0x7f ) ;
  var ed = this.apr.getPdr( index ).readBit( 3 ) ;
  var control = this.apr.getPdr( index ).readPartial( 1, 0x3 ) ;

  // temporal
  if( ( ed && blockNum < length ) || ( ! ed && blockNum > length ) ) {
//    this.ssr2.writeWord( this.pdp11._getPc( ).readWord( ) ) ;
    this.ssr2.writeWord( this.pdp11.prePc ) ;
    // TODO: confirm
    var sr0 = ( 1 << 14 ) | 1 ;
    sr0 |= ( v_address >> 12 ) & ~1 ;
    if( ! this.psw.currentModeIsKernel( ) )
      sr0 |= ( 1 << 5 ) | ( 1 << 6 ) ;
    this.ssr0.writeWord( sr0 ) ;
    throw RangeError( '' ) ;
  }
  if( p_address == Mmu._TRAP_POINT )  // temporal
    throw new Error( '' ) ;

  return p_address ;
} ;

Mmu.prototype.dump = function( ) {
  var buffer = '' ;
  buffer += 'SSR0:' + format( this.ssr0.readWord( ) ) + ', ' ;
  buffer += 'SSR2:' + format( this.ssr2.readWord( ) ) + ', ' ;
  return buffer ;
} ;

// TODO: modify
Mmu.prototype.loadWordByPhysicalAddress = function( p_address ) {
  if( p_address >= 0760000 )
    return this._map( p_address ).readWord( ) ;
  return this.memory.loadWord( p_address ) ;
} ;

// TODO: modify
Mmu.prototype.loadByteByPhysicalAddress = function( p_address ) {
  if( p_address >= 0760000 )
    return this._map( p_address ).readLowByte( ) ;
  return this.memory.loadByte( p_address ) ;
} ;

// TODO: modify
Mmu.prototype.storeWordByPhysicalAddress = function( p_address, value ) {
  if( p_address >= 0760000 )
    this._map( p_address ).writeWord( value ) ;
  else
    this.memory.storeWord( p_address, value ) ;
} ;

// TODO: modify
Mmu.prototype.storeByteByPhysicalAddress = function( p_address, value ) {
  if( p_address >= 0760000 )
    this._map( p_address ).writeLowByte( value ) ;
  else
    this.memory.storeByte( p_address, value ) ;
} ;
