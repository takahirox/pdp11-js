/**
 * ConsoleLogger
 */

__jsimport( "utility/Inherit.js" ) ;
__jsimport( "utility/Logger.js" ) ;

/**
 *
 */
function ConsoleLogger( level ) {
  Logger.call( this, level ) ;
}

ConsoleLogger.prototype = __inherit( Logger.prototype ) ;
ConsoleLogger.prototype.constructor = ConsoleLogger ;

ConsoleLogger.prototype.assert = function( bool ) {
  console.assert( bool ) ;
} ;

ConsoleLogger.prototype._debug = function( str ) {
  console.debug( str ) ;
} ;

ConsoleLogger.prototype._log = function( str ) {
  console.log( str ) ;
} ;

ConsoleLogger.prototype._warn = function( str ) {
  console.warn( str ) ;
} ;

ConsoleLogger.prototype._error = function( str ) {
  console.error( str ) ;
} ;
