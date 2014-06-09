/**
 *
 */

__jsimport( "pdp11/Pdp11.js" ) ;

/**
 *
 */
function DebugFigureView( pdp11, canvas ) {
  this.pdp11 = pdp11 ;
  this.canvas = canvas ;
  this.surface = canvas.getContext( '2d' ) ;
  this.width = canvas.getAttribute( 'width' ) ;
  this.height = canvas.getAttribute( 'height' ) ;
}

DebugFigureView.prototype.update = function( ) {
  this.surface.clearRect( 0, 0, this.width, this.height ) ;
  this.surface.fillText( this.pdp11.psw.currentModeIsKernel( ) ? 'kernel' : 'user',
                         this.width / 2 - 3, 10 ) ;
  this.surface.fillStyle = '#000000' ;
  this.surface.fillRect( 0,
                         this._calculateStackPointer( ) * this.height,
                         this.width,
                         this.height ) ;
} ;

DebugFigureView.prototype._calculateStackPointer = function( ) {
  if( this.pdp11.psw.currentModeIsKernel( ) ) {
    return 1 ;
  } else {
    return this.pdp11._getSp( ).readWord( ) / 0x10000 ;
  }
} ;
