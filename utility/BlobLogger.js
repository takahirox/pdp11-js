/**
 * BlobLogger
 */

__jsimport( "utility/Inherit.js" ) ;
__jsimport( "utility/Logger.js" ) ;

/**
 *
 */
function BlobLogger( level ) {
  Logger.call( this, level ) ;
  this.array = [ ] ;
}

BlobLogger.prototype = __inherit( Logger.prototype ) ;
BlobLogger.prototype.constructor = BlobLogger ;

BlobLogger.prototype.assert = function( bool ) {
  console.assert( bool ) ;
} ;

BlobLogger.prototype._debug = function( str ) {
  this.array.push( str + "\n" ) ;
} ;

BlobLogger.prototype._log = function( str ) {
  this.array.push( str + "\n" ) ;
} ;

BlobLogger.prototype._warn = function( str ) {
  this.array.push( str + "\n" ) ;
} ;

BlobLogger.prototype._error = function( str ) {
  this.array.push( str + "\n" ) ;
} ;

BlobLogger.prototype.getUrl = function( ) {
  return window.URL.createObjectURL( new Blob( this.array ) ) ;
} ;
