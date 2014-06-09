function RegisterTest( ) {
  this.register = new Register( ) ;
}

RegisterTest.prototype.run = function( ) {
  __logger.assert( this.register.read_word( ) == 0x0 ) ;
  __logger.assert( this.register.read_high_byte( ) == 0x0 ) ;
  __logger.assert( this.register.read_low_byte( ) == 0x0 ) ;

  this.register.write_word( 0x1234 ) ;
  __logger.assert( this.register.read_word( ) == 0x1234 ) ;
  __logger.assert( this.register.read_high_byte( ) == 0x12 ) ;
  __logger.assert( this.register.read_low_byte( ) == 0x34 ) ;

  this.register.increment_word( ) ;
  __logger.assert( this.register.read_word( ) == 0x1236 ) ;
  __logger.assert( this.register.read_high_byte( ) == 0x12 ) ;
  __logger.assert( this.register.read_low_byte( ) == 0x36 ) ;

} ;
