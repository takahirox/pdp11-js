function JsImporter( ) {
  this.paths = { } ;
}

JsImporter.prototype.import = function( path ) {
  if( this.paths[ path ] )
    return ;
  this.paths[ path ] = true ;
  this._import( path ) ;
} ;

JsImporter.prototype._import = function( path ) {
  document.write( "<script type='text/javascript' src='" + path + "'></script>" ) ;
} ;

JsImporter.prototype._import2 = function( path ) {
  var xhr = null ;
  if( window.XMLHttpRequest ) {
    xhr = new XMLHttpRequest( ) ;
  } else if( window.ActiveXObject ) {
    try {
      xhr = new ActiveXObject( "Msxml2.XMLHTTP" ) ;
    } catch( e ) {
      xhr = new ActiveXObject( "Microsoft.XMLHTTP" ) ;
    }
  }
  xhr.open( "GET", path, false ) ;
  xhr.send( "" ) ;
  eval( xhr.responseText ) ;
} ;


var __jsimporter = new JsImporter( ) ;

function __jsimport( path ) {
  __jsimporter.import( path ) ;
}
