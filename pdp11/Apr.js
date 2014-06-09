/**
 * Active Page Register
 */

__jsimport( "pdp11/Psw.js" ) ;
__jsimport( "pdp11/Register.js" ) ;


/**
 *
 */
function Apr( ) {
  this.psw = null ;
  this.kernelPars = new Array( ) ;
  this.kernelPdrs = new Array( ) ;
  this.userPars = new Array( ) ;
  this.userPdrs = new Array( ) ;
  for( var i = 0; i < Apr._NUM_OF_APRS; i++ ) {
    this.kernelPars.push( new Register( ) ) ;
    this.kernelPdrs.push( new Register( ) ) ;
    this.userPars.push( new Register( ) ) ;
    this.userPdrs.push( new Register( ) ) ;
  }
}

Apr._NUM_OF_APRS = 8 ;


/**
 *
 */
Apr.prototype.setPsw = function( psw ) {
  this.psw = psw ;
} ;


/**
 *
 */
Apr.prototype.getPar = function( index ) {
  return this.psw.currentModeIsKernel( )
           ? this.kernelPars[ index ]
           : this.userPars[ index ] ;
} ;


/**
 *
 */
Apr.prototype.getPdr = function( index ) {
  return this.psw.currentModeIsKernel( )
           ? this.kernelPdrs[ index ]
           : this.userPdrs[ index ] ;
} ;


/**
 *
 */
Apr.prototype.dump = function( ) {
  var buffer = '' ;
  for( var i = 0; i < Apr._NUM_OF_APRS; i++ ) {
    buffer += 'KPAR' + i + ':' + format( this.kernelPars[ i ].readWord( ) ) + ', ' ;
    buffer += 'KPDR' + i + ':' + format( this.kernelPdrs[ i ].readWord( ) ) + ', ' ;
  }
  for( var i = 0; i < Apr._NUM_OF_APRS; i++ ) {
    buffer += 'UPAR' + i + ':' + format( this.userPars[ i ].readWord( ) ) + ', ' ;
    buffer += 'UPDR' + i + ':' + format( this.userPdrs[ i ].readWord( ) ) + ', ' ;
  }
  return buffer ;
} ;
