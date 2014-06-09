/**
 * Terminal
 */

__jsimport( "pdp11/Register.js" ) ;
__jsimport( "pdp11/TextAreaView.js" ) ;

/**
 *
 */
function Terminal( pdp11, view ) {
  this.rsr = new RegisterWithCallBack( this.writeRsrCallback.bind( this ) ) ;
  this.rbr = new RegisterWithCallBack( null, this.readRbrCallback.bind( this ) ) ;
  this.xsr = new Register( ) ;
  this.xbr = new RegisterWithCallBack( this.checkXbr.bind( this ) ) ;
  this.xsr.writeBit( Terminal._XSR_DONE_BIT, true ) ;
  this.pdp11 = pdp11 ;
  this.view = view ;
  this.step = 0 ;
  this.busy = false ;
  this.view.clear( ) ;
}

Terminal._INTERVAL = 1 ;

Terminal._RSR_BUSY_BIT = 11 ;
Terminal._RSR_DONE_BIT = 7 ;
Terminal._RSR_ENABLE_INTERRUPT_BIT = 6 ;
Terminal._RSR_READY_BIT = 0 ;
Terminal._INPUT_INTERRUPT_VECTOR = 060 ;
Terminal._INPUT_INTERRUPT_LEVEL = 4 ;

Terminal._XSR_DONE_BIT = 7 ;
Terminal._XSR_ENABLE_INTERRUPT_BIT = 6 ;
Terminal._OUTPUT_INTERRUPT_VECTOR = 064 ;
Terminal._OUTPUT_INTERRUPT_LEVEL = 4 ;

Terminal.prototype.run = function( ) {

  this.step++ ;
  if( this.step >= Terminal._INTERVAL && this.xbr.readWord( )
      && ! this.xsr.readBit( Terminal._XSR_DONE_BIT ) ) {
    if( this.xbr.readWord( ) != 0177 &&
        ( this.xbr.readWord( ) & 0x7f ) != 0xd ) { // temporal
      this.view.output( String.fromCharCode( this.xbr.readWord( ) & 0x7f ) ) ;
    }
    this.xsr.writeBit( Terminal._XSR_DONE_BIT, true ) ;
    this.xbr.writeWord( 0 ) ;
    if( this.xsr.readBit( Terminal._XSR_ENABLE_INTERRUPT_BIT ) ) {
      this.pdp11.interrupt( Terminal._OUTPUT_INTERRUPT_LEVEL,
                            Terminal._OUTPUT_INTERRUPT_VECTOR ) ;
    }
    this.step = 0 ;
  }
} ;

Terminal.prototype.checkXbr = function( ) {
  if( this.xbr.readWord( ) ) {
    this.xsr.writeBit( Terminal._XSR_DONE_BIT, false ) ;
    this.step = 0 ;
  }
} ;

Terminal.prototype.writeRsrCallback = function( ) {
  if( this.rsr.readBit( Terminal._RSR_READY_BIT, true ) ) {
    this.rsr.writeBit( Terminal._RSR_READY_BIT, false, true ) ;
    this.rsr.writeBit( Terminal._RSR_DONE_BIT, false, true ) ;
  }
} ;

Terminal.prototype.readRbrCallback = function( ) {
  if( this.rsr.readBit( Terminal._RSR_DONE_BIT, true ) ) {
    this.rsr.writeBit( Terminal._RSR_READY_BIT, false, true ) ;
    this.rsr.writeBit( Terminal._RSR_DONE_BIT, false, true ) ;
  }
} ;

Terminal.prototype.input = function( ascii ) {
  this.rbr.writeWord( ascii & 0x7f, true ) ;
  this.rsr.writeBit( Terminal._RSR_READY_BIT, true ) ;
  this.rsr.writeBit( Terminal._RSR_DONE_BIT, true ) ;
  if( this.rsr.readBit( Terminal._RSR_ENABLE_INTERRUPT_BIT, true ) ) {
    this.pdp11.interrupt( Terminal._INPUT_INTERRUPT_LEVEL, Terminal._INPUT_INTERRUPT_VECTOR ) ;
  }
//  if( this.rsr.readBit( Terminal._RSR_READY_BIT ) ) {
//    this.rsr.writeBit( Terminal._RSR_DONE_BIT, false ) ;
//  }
//  if( this.rsr.readBit( Terminal._RSR_DONE_BIT ) &&
//      this.rsr.readBit( Terminal._RSR_ENABLE_INTERRUPT_BIT ) ) {
//    this.pdp11.interrupt( Terminal._INPUT_INTERRUPT_LEVEL, Terminal._INPUT_INTERRUPT_VECTOR ) ;
//  }
} ;
