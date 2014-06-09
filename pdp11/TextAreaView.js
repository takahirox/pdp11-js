function TextAreaView( id ) {
  this.view = window.document.getElementById( id ) ;
  this.clear( ) ;
}

TextAreaView.prototype.output = function( str ) {
  this.view.firstChild.appendData( str ) ;
  this.view.scrollTop = this.view.scrollHeight ;
} ;

TextAreaView.prototype.outputLine = function( str ) {
  this.output( str + '\n' ) ;
} ;

TextAreaView.prototype.clear = function( ) {
  this.view.firstChild.deleteData( 0, this.view.firstChild.nodeValue.length ) ;
} ;

TextAreaView.prototype.focus = function( ) {
  this.view.focus( ) ;
} ;


function LimitedLinesTextAreaView( id ) {
  this.view = window.document.getElementById( id ) ;
  this.lines = [ ] ;
  this.length = this.view.getAttribute( 'rows' ) - 1 ;
}

LimitedLinesTextAreaView.prototype.outputLine = function( str ) {
  this.lines.push( str + '\n' ) ;
  while( this.lines.length > this.length ) {
    this.lines.shift( ) ;
  }
  this.flush( ) ;
} ;

LimitedLinesTextAreaView.prototype.clear = function( ) {
  this.view.firstChild.deleteData( 0, this.view.firstChild.nodeValue.length ) ;
} ;

LimitedLinesTextAreaView.prototype.flush = function( ) {
  this.clear( ) ;
  for( var i = 0; i < this.lines.length; i++ ) {
    this.view.firstChild.appendData( this.lines[ i ] ) ;
  }
  this.view.scrollTop = this.view.scrollHeight ;
} ;

