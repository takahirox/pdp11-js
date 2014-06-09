/**
 * Disk
 */

__jsimport( "pdp11/Register.js" ) ;


/**
 *
 */
function Disk( pdp11 ) {
  this.pdp11 = pdp11 ;
  this.rkds = new Register( ) ;
  this.rker = new Register( ) ;
  this.rkcs = new RegisterWithCallBack( this.check.bind( this ) ) ;
  this.rkwc = new Register( ) ;
  this.rkba = new Register( ) ;
  this.rkda = new Register( ) ;
  this.rkdb = new Register( ) ;
  this.rkcs.writeBit( Disk._RKCS_READY_BIT, true, true ) ;

  var buffer = new ArrayBuffer( Disk._CAPACITY ) ;
  this.uint16 = new Uint16Array( buffer ) ;

  this.step = 0 ;
  this.busy = false ;
  this.length = 0 ;
}

Disk._CAPACITY = 512 * 4800 * 8 ; // 512bytes x 4800records x 8drives
Disk._INTERVAL = 100 ;
Disk._INTERRUPT_LEVEL = 5 ;
Disk._INTERRUPT_VECTOR = 0220 ;

Disk._COMMAND_READ  = 02 ;
Disk._COMMAND_WRITE = 01 ;

Disk._RKDA_DRIVE_BIT    = 13 ;
Disk._RKDA_CYLINDER_BIT = 5 ;
Disk._RKDA_SIDE_BIT     = 4 ;
Disk._RKDA_SECTOR_BIT   = 0 ;

Disk._RKDA_DRIVE_MASK    = 0x7 ;
Disk._RKDA_CYLINDER_MASK = 0xff ;
Disk._RKDA_SIDE_MASK     = 0x1 ;
Disk._RKDA_SECTOR_MASK   = 0xf ;

Disk._RKCS_READY_BIT = 7 ;
Disk._RKCS_ENABLE_INTERRUPT_BIT = 6 ;

Disk._RKCS_COMMAND_BIT  = 1 ;
Disk._RKCS_COMMAND_MASK = 0x7 ;


/**
 *
 */
Disk.prototype.run = function( ) {

  if( ! this.busy )
    return ;

  this.step++ ;
  if( this.step >= Disk._INTERVAL ) {
    if( this._go( ) ) {
      switch( this._getCommand( ) ) {
        case Disk._COMMAND_READ:
          this._runLoad( ) ;
          break ;
        case Disk._COMMAND_WRITE:
          this._runStore( ) ;
          break ;
        default:
          throw new Error( "not implemented yet." ) ;
          break ;
      }
      this.busy = false ;
      this.rkcs.writeBit( Disk._RKCS_READY_BIT, true, true ) ;
      if( this.rkcs.readBit( Disk._RKCS_ENABLE_INTERRUPT_BIT, true ) ) {
        this.pdp11.interrupt( Disk._INTERRUPT_LEVEL, Disk._INTERRUPT_VECTOR ) ;
      }
    }
    this.step = 0 ;
  }

} ;


/**
 *
 */
Disk.prototype.check = function( ) {
  if( this._go( ) ) {
    this.step = 0 ;
    this.busy = true ;
  }
} ;


/**
 *
 */
Disk.prototype._getCommand = function( ) {
  return this.rkcs.readPartial( Disk._RKCS_COMMAND_BIT, Disk._RKCS_COMMAND_MASK, true ) ;
} ;


/**
 *
 */
Disk.prototype._go = function( ) {
  return this.rkcs.readWord( true ) & 1 ;
} ;


/**
 *
 */
Disk.prototype._calculateDiskAddress = function( ) {
  var driveNum = this.rkda.readPartial( Disk._RKDA_DRIVE_BIT, Disk._RKDA_DRIVE_MASK ) ;
  var cylinderNum = this.rkda.readPartial( Disk._RKDA_CYLINDER_BIT, Disk._RKDA_CYLINDER_MASK ) ;
  var side = this.rkda.readPartial( Disk._RKDA_SIDE_BIT, Disk._RKDA_SIDE_MASK ) ;
  var sectorNum = this.rkda.readPartial( Disk._RKDA_SECTOR_BIT, Disk._RKDA_SECTOR_MASK ) ;

  return ( driveNum * 4800 + cylinderNum * 24 + side * 12 + sectorNum ) * 512 ;
} ;


/**
 *
 */
Disk.prototype._calculateMemoryAddress = function( ) {
  // temporal
  return ( this.rkcs.readPartial( 4, 0x3 ) << 16 ) | this.rkba.readWord( ) ;
} ;


/**
 *
 */
Disk.prototype._getWordCount = function( ) {
  return to_int16( this.rkwc.readWord( ) * -1 ) ;
} ;


/**
 *
 */
Disk.prototype._runLoad = function( ) {
  __logger.log( this._dump( ) ) ;
  for( var i = 0; i < this._getWordCount( ); i++ ) {
    __logger.log( "disk:" + format( this._calculateDiskAddress( ) + i * 2 ) +
                  " -> " + format( this._loadWord( this._calculateDiskAddress( ) + i * 2 ) ) + " -> " +
                  "memory:" + format( this._calculateMemoryAddress( ) + i * 2 ) ) ;
    this.pdp11.mmu.storeWordByPhysicalAddress(
      this._calculateMemoryAddress( ) + i * 2,
      this._loadWord( this._calculateDiskAddress( ) + i * 2 ) ) ;
  }
} ;


/**
 *
 */
Disk.prototype._runStore = function( ) {
  __logger.log( this._dump( ) ) ;
  for( var i = 0; i < this._getWordCount( ); i++ ) {
    __logger.log( "disk:" + format( this._calculateDiskAddress( ) + i * 2 ) +
                  " <- " + format( this.pdp11.mmu.loadWordByPhysicalAddress( this._calculateMemoryAddress( ) + i * 2 ) ) + " <- " +
                  "memory:" + format( this._calculateMemoryAddress( ) + i * 2 ) ) ;
    this._storeWord(
      this._calculateDiskAddress( ) + i * 2,
      this.pdp11.mmu.loadWordByPhysicalAddress( this._calculateMemoryAddress( ) + i * 2 ) ) ;
  }
} ;


/**
 *
 */
Disk.prototype.importBuffer = function( buffer ) {
  var array = new Uint16Array( buffer ) ;
  for( var i = 0; i < array.length; i++ ) {
    this.uint16[ i ] =  array[ i ] ;
  }
  this.length = array.length ;
} ;


/**
 *
 */
Disk.prototype.exportBuffer = function( ) {
  var array = new Uint16Array( this.length ) ;
  for( var i = 0; i < this.length; i++ ) {
    array[ i ] = this.uint16[ i ] ;
  }
  return array.buffer ;
} ;


/**
 *
 */
Disk.prototype._loadWord = function( address ) {
  return this.uint16[ address >> 1 ] ;
} ;


/**
 *
 */
Disk.prototype._storeWord = function( address, value ) {
  this.uint16[ address >> 1 ] = value ;
} ;


/**
 *
 */
Disk.prototype._dump = function( ) {
  buffer = '' ;
  buffer +=   "rkds:" + format( this.rkds.readWord( ) ) ;
  buffer += ", rker:" + format( this.rker.readWord( ) ) ;
  buffer += ", rkcs:" + format( this.rkcs.readWord( ) ) ;
  buffer += ", rkwc:" + format( this.rkwc.readWord( ) ) 
         +  "(" + this._getWordCount( ) + ")" ;
  buffer += ", rkba:" + format( this.rkba.readWord( ) ) ;
  buffer += ", rkda:" + format( this.rkda.readWord( ) ) 
         +  "(" + format( this._calculateDiskAddress( ) / 512 )+ ")" ;
  buffer += ", rkdb:" + format( this.rkdb.readWord( ) ) ;
  return buffer ;
} ;
