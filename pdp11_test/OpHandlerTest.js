__jsimport( "pdp11/Pdp11.js" ) ;
__jsimport( "pdp11/OpCode.js" ) ;
__jsimport( "pdp11/OpHandler.js" ) ;

function OpHandlerTest( ) {
  this.pdp11 = new Pdp11( ) ;
}

OpHandlerTest.prototype.run = function( ) {
  for( var prop in this ) {
    if( prop.indexOf( "_test" ) >= 0 ) {
      console.log( "function: " + prop ) ;
      this[ prop ]( ) ;
    }
  }
} ;

OpHandlerTest.prototype.br_test = function( ) {
  var opc = 0000400 ;
  var name = 'br' ;

  var code = opc ;
  var op = this.pdp11._decode( code ) ;
  console.log( op.op == name ) ;

  this.pdp11._getPc( ).writeWord( 0 ) ;
  op.run( this.pdp11, code ) ;
  console.log( this.pdp11._getPc( ).readWord( ) == 0 ) ;

  var code = opc | 0377;
  var op = this.pdp11._decode( code ) ;
  console.log( op.op == name ) ;

  this.pdp11._getPc( ).writeWord( 10 ) ;
  op.run( this.pdp11, code ) ;
  console.log( this.pdp11._getPc( ).readWord( ) == 8 ) ;

  var code = opc | 0377;
  var op = this.pdp11._decode( code ) ;
  console.log( op.op == name ) ;

  this.pdp11._getPc( ).writeWord( 0100000 ) ;
  op.run( this.pdp11, code ) ;
  console.log( this.pdp11._getPc( ).readWord( ) == 0077776 ) ;
} ;

OpHandlerTest.prototype.jmp_test = function( ) {
  var opc = 0000100 ;
  var name = 'jmp' ;

  var code = opc | 010 ;
  var op = this.pdp11._decode( code ) ;
  console.log( op.op == name ) ;

  this.pdp11._getPc( ).writeWord( 0 ) ;
  this.pdp11._getReg( 0 ).writeWord( 10 ) ;
  op.run( this.pdp11, code ) ;
  console.log( this.pdp11._getPc( ).readWord( ) == 10 ) ;

} ;

