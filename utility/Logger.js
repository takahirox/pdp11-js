/**
 * Logger
 */

/**
 *
 */
function Logger( level ) {
  this.setLevel( level ? level : Logger.LOG_LEVEL ) ;
}

Logger.DEBUG_LEVEL = 1 ;
Logger.LOG_LEVEL   = 2 ;
Logger.WARN_LEVEL  = 3 ;
Logger.ERROR_LEVEL = 4 ;
Logger.NONE_LEVEL  = 5 ;

Logger.prototype.setLevel = function( level ) {
  this.level = level ;
} ;

/**
 * @param str
 */
Logger.prototype.debug = function( str ) {
  if( this.level <= Logger.DEBUG_LEVEL )
    this._debug( str ) ;
} ;

/**
 * @param str
 */
Logger.prototype.log = function( str ) {
  if( this.level <= Logger.LOG_LEVEL )
    this._log( str ) ;
} ;

/**
 * @param str
 */
Logger.prototype.warn = function( str ) {
  if( this.level <= Logger.WARN_LEVEL )
    this._warn( str ) ;
} ;

Logger.prototype.error = function( str ) {
  if( this.level <= Logger.ERROR_LEVEL )
    this._error( str ) ;
} ;

Logger.prototype.assert = function( bool ) {
  throw new Error( "assert must be inherited." ) ;
} ;

Logger.prototype._debug = function( str ) {
  throw new Error( "_debug must be inherited." ) ;
} ;

Logger.prototype._log = function( str ) {
  throw new Error( "_log must be inherited." ) ;
} ;

Logger.prototype._warn = function( str ) {
  throw new Error( "_warn must be inherited." ) ;
} ;

Logger.prototype._error = function( str ) {
  throw new Error( "_error must be inherited." ) ;
} ;
