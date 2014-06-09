/**
 *
 */


/**
 * @constructor
 */
function Memory( ) {
  var buffer = new ArrayBuffer( Memory._CAPACITY ) ;
  this.uint8  = new Uint8Array( buffer ) ;
  this.uint16 = new Uint16Array( buffer ) ;
}

Memory._CAPACITY = 01000000 ;


/**
 * @param address
 * @return 
 */
Memory.prototype.loadWord = function( address ) {
  return this.uint16[ address >> 1 ] ;
} ;


/**
 * @param address
 * @return 
 */
Memory.prototype.loadByte = function( address ) {
  return this.uint8[ address ] ;
} ;


/**
 * @param address
 * @param value
 */
Memory.prototype.storeWord = function( address, value ) {
  this.uint16[ address >> 1 ] = value ;
} ;


/**
 * @param address
 * @param value
 */
Memory.prototype.storeByte = function( address, value ) {
  this.uint8[ address ] = value ;
} ;


/**
 * @param buffer
 */
Memory.prototype.storeBuffer = function( offset, buffer ) {
  var array = new Uint8Array( buffer ) ;
  for( var i = 0; i < array.byteLength; i++ ) {
    this.storeByte( i + offset, array[ i ] ) ;
  }
} ;
