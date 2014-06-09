/**
 *
 */


/**
 *
 */
function format( num, digit ) {
  return sprintf( __num_format, num, digit ? digit : __num_digit ) ;
}


/**
 * @param {Integer} type bin->2, oct->8, degit->10, hex->16
 * @param {Integer} num
 * @param {Integer} figures
 */
function sprintf( type, num, figure ) {

  var base = '' ;
  var prefix = ''
  var minus = '' ;

  if( type == 8 )
    prefix = '0' ;
  else if( type == 16 )
    prefix = '0x' ;

  for( var i = 0; i < figure; i++ )
    base += '0' ;

  return prefix + ( base + num.toString( type ) ).substr( -1 * figure ) ;

}


/**
 *
 */
function to_int32( uint32 ) {
  var buffer = new ArrayBuffer( 4 ) ;
  var int32 = new Int32Array( buffer ) ;
  int32[ 0 ] = uint32 ;
  return int32[ 0 ] ;
}


/**
 *
 */
function to_int16( uint16 ) {
  var buffer = new ArrayBuffer( 2 ) ;
  var int16 = new Int16Array( buffer ) ;
  int16[ 0 ] = uint16 ;
  return int16[ 0 ] ;
}


/**
 *
 */
function to_int8( uint8 ) {
  var buffer = new ArrayBuffer( 1 ) ;
  var int8 = new Int8Array( buffer ) ;
  int8[ 0 ] = uint8 ;
  return int8[ 0 ] ;
}


/**
 *
 */
function to_uint16( int16 ) {
  var buffer = new ArrayBuffer( 2 ) ;
  var uint16 = new Uint16Array( buffer ) ;
  uint16[ 0 ] = int16 ;
  return uint16[ 0 ] ;
}


/**
 *
 */
function to_uint8( int8 ) {
  var buffer = new ArrayBuffer( 1 ) ;
  var uint8 = new Uint8Array( buffer ) ;
  uint8[ 0 ] = int8 ;
  return uint8[ 0 ] ;
}
