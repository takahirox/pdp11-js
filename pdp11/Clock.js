/**
 * Clock KW11-L
 */

__jsimport( "pdp11/Register.js" ) ;


/**
 *
 */
function Clock( pdp11 ) {
  this.register = new RegisterWithCallBack( this.writeCallBack.bind( this ) ) ;
  this.pdp11 = pdp11 ;
  this.busy = false ;
  this.step = 0 ;
}

Clock._INTERVAL = 40000 ; // what is the appropriate number?

Clock._INTERRUPT_VECTOR = 0100 ;
Clock._INTERRUPT_LEVEL = 6 ;

Clock._INTURRUPT_HAPPEN_BIT = 7 ; // unused here
Clock._ENABLE_INTERRUPT_BIT = 6 ;


Clock.prototype.run = function( ) {

  if( ! this.busy )
    return ;

  this.step++ ;
  if( this.step >= Clock._INTERVAL &&
      this.register.readBit( Clock._ENABLE_INTERRUPT_BIT, true ) ) {
    this.pdp11.interrupt( Clock._INTERRUPT_LEVEL, Clock._INTERRUPT_VECTOR ) ;
    this.register.writeBit( Clock._ENABLE_INTERRUPT_BIT, false, true ) ;
    this.busy = false ;
  }

} ;


Clock.prototype.writeCallBack = function( ) {
  if( this.register.readBit( Clock._ENABLE_INTERRUPT_BIT, true ) ) {
    this.step = 0 ;
    this.busy = true ;
  }
} ;

