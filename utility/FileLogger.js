/**
 * FileLogger
 */

__jsimport( "utility/Inherit.js" ) ;
__jsimport( "utility/Logger.js" ) ;

/**
 *
 */
function FileLogger( name, level ) {
  Logger.call( this, level ) ;
  this.fileName = name ;
  this.fileSize = 1024 * 1024 * 500 ; // 500MB
  this._remove( ) ;
  this.errorHandler = function( error ) { alert( error.code ) } ;
}

FileLogger.prototype = __inherit( Logger.prototype ) ;
FileLogger.prototype.constructor = FileLogger ;

FileLogger.prototype.assert = function( bool ) {
  console.assert( bool ) ;
} ;

FileLogger.prototype._debug = function( str ) {
  this._output( str + "\n" ) ;
} ;

FileLogger.prototype._log = function( str ) {
  this._output( str + "\n" ) ;
} ;

FileLogger.prototype._warn = function( str ) {
  this._output( str + "\n" ) ;
} ;

FileLogger.prototype._error = function( str ) {
  this._output( str + "\n" ) ;
} ;

FileLogger.prototype.getUrl = function( ) {
  return window.URL.createObjectURL( new File( this.array ) ) ;
} ;

FileLogger.prototype._output = function( str ) {
  window.webkitRequestFileSystem( window.PERSISTENT, this.fileSize, function( fs ) {
    fs.root.getFile( this.fileName, {create: true}, function( fileEntry ) {
      fileEntry.createWriter( function( fileWriter ) {
        fileWriter.onwriteend = function( e ) { console.log( "done." ) ; } ;
        fileWriter.onerror = function( e ) { console.log( "error." ) ;} ;
        fileWriter.write( str ) ;
      }, this.errorHandler ) ;
    }, this.errorHandler ) ;
  }, this.errorHandler ) ;
} ;

FileLogger.prototype._remove = function( ) {
  window.webkitRequestFileSystem( window.PERSISTENT, this.fileSize, function( fs ) {
    fs.root.getFile( this.fileName, {create: false}, function( fileEntry ) {
      fileEntry.remove( function( ) {
        this._output( "hoge" ) ;
      }, this.errorHandler ) ;
    }, this.errorHandler ) ;
  }, this.errorHandler ) ;
} ;

