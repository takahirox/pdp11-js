/**
 * Register Emulation Suites for JavaScript
 * @author Takahiro <hogehoge@gachapin.jp>
 * TODO: Bad design
 */


/**
 * Register prototype
 *
 * This prototype provides a 16bit register emulation.
 * This prototype is pretty simple.
 * You can only write or read data into/from this.
 *
 * @constructor
 */
function Register( ) {
    var buffer = new ArrayBuffer( Register._wordSize ) ;
    this.uint8 = new Uint8Array( buffer ) ;
    this.uint16 = new Uint16Array( buffer ) ;
    this.uint16[ 0 ] = 0 ;
}

Register._wordSize = 2 ; // 2bytes


/**
 * Read word as unsigned 16bit integer.
 * @return the word data of register
 */
Register.prototype.readWord = function( ) {
  return this.uint16[ 0 ] ;
} ;


/**
 * Read lower byte as unsigned 8bit integer.
 * @return the lower byte data of register
 */
Register.prototype.readLowByte = function( ) {
  return this.uint8[ 0 ] ;
} ;


/**
 * Read higher byte as unsigned 8bit integer.
 * @return the higher byte data of register
 */
Register.prototype.readHighByte = function( ) {
  return this.uint8[ 1 ] ;
} ;


/**
 * Read the partial data of register.
 * For instance, if the data of register is 0001_0010_0011_0100b,
 * offset is 2(bits), and mask is 3(11b), the result is 01b.
 * If mask were width bit, this API would be more straight forward.
 * But mask bit is easier to implement.
 * @param offset bit offset from LSB.
 * @param mask mask bit.
 * @return 
 */
Register.prototype.readPartial = function( offset, mask ) {
  return this._readPartial( offset, mask ) ;
} ;


/**
 * Read a bit of register.
 * @param bit 
 * @return the higher byte data of register
 */
Register.prototype.readBit = function( bit ) {
  return this._readPartial( bit, 1 ) == 1 ? true : false ;
} ;


/**
 * Read the partial data of register.
 * For instance, if the data of register is 0001_0010_0011_0100b,
 * offset is 2(bits), and mask is 3(11b), the result is 01b.
 * If mask were width bit, this API would be more straight forward.
 * But mask bit is easier to implement.
 * @param offset bit offset from LSB.
 * @param mask mask bit.
 * @return 
 */
Register.prototype._readPartial = function( offset, mask ) {
  return ( this.uint16[ 0 ] >> offset ) & mask ;
} ;


/**
 * Write word.
 * @param written unsigned 16bit integer.
 */
Register.prototype.writeWord = function( value ) {
  this.uint16[ 0 ] = value ;
} ;


/**
 * Write lower byte. Higher byte will be unchanged.
 * @param written unsigned 8bit integer.
 */
Register.prototype.writeLowByte = function( value ) {
  this.uint8[ 0 ] = value ;
} ;


/**
 * Write higher byte. Lower byte will be unchanged.
 * @param written unsigned 8bit integer.
 */
Register.prototype.writeHighByte = function( value ) {
  this.uint8[ 1 ] = value ;
} ;


/**
 * Partially writte the data of register.
 * For instance, if the data of register is 0001_0010_0011_0100b,
 * value is 10b, offset is 2(bits), and mask is 11b, the result is 0001_0010_0011_1000b.
 * @param value written data.
 * @param offset bit offset from LSB.
 * @param mask mask bit.
 * @see Register.read_partial
 * TODO: change 0xffff to word size unspecific one.
 */
Register.prototype.writePartial = function( value, offset, mask ) {
  this._writePartial( value, offset, mask ) ;
} ;


Register.prototype.writeBit = function( bit, value ) {
  this._writePartial( value ? 1 : 0, bit, 1 ) ;
} ;


Register.prototype._writePartial = function( value, offset, mask ) {
  this.uint16[ 0 ] = ( ( this.readWord( )
                       & ( 0xffff & ~( mask << offset ) ) )
                       | ( value << offset ) ) ;
} ;


/**
 * Increment the value of refister by word size and then return the word.
 * This function is assumed to be called for CPU addressing mode.
 * @return incremented value as word.
 * TODO: rename to incrementByWord
 */
Register.prototype.incrementWord = function( ) {
  this.uint16[ 0 ] += 2 ;
  return this.readWord( ) ;
} ;


/**
 * Increment the value of refister by byte size and then return the word.
 * This function is assumed to be called for CPU addressing mode.
 * @return incremented value as word.
 * TODO: rename to incrementByByte
 */
Register.prototype.incrementByte = function( ) {
  this.uint16[ 0 ] += 1 ;
  return this.readWord( ) ;
} ;


/**
 * Decrement the value of refister by word size and then return the word.
 * This function is assumed to be called for CPU addressing mode.
 * @return incremented value as word.
 * TODO: rename to decrementByWord
 */
Register.prototype.decrementWord = function( ) {
  this.uint16[ 0 ] -= 2 ;
  return this.readWord( ) ;
} ;


/**
 * Decrement the value of refister by byte size and then return the word.
 * This function is assumed to be called for CPU addressing mode.
 * @return incremented value as word.
 * TODO: rename to decrementByByte
 */
Register.prototype.decrementByte = function( ) {
  this.uint16[ 0 ] -= 1 ;
  return this.readWord( ) ;
} ;




__jsimport( "utility/Inherit.js" ) ;

/**
 * Some peripherals are driven by writing or reading a register
 * which the peripheral has.
 *
 * This class is for such peripherals.
 *
 * @author Takahiro <hogehoge@gachapin.jp>
 */
function RegisterWithCallBack( writeCallback, readCallback ) {
  Register.call( this ) ;
  this.writeCallback = writeCallback ;
  this.readCallback = readCallback ;
}

RegisterWithCallBack.prototype = __inherit( Register.prototype ) ;
RegisterWithCallBack.prototype.constructor = RegisterWithCallBack ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype._doWriteCallback = function( prevent ) {
  if( ! prevent && this.writeCallback )
    this.writeCallback( ) ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype._doReadCallback = function( prevent ) {
  if( ! prevent && this.readCallback )
    this.readCallback( ) ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype.readWord = function( prevent ) {
  var value = Register.prototype.readWord.call( this ) ;
  this._doReadCallback( prevent ) ;
  return value ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype.readLowByte = function( prevent ) {
  var value = Register.prototype.readLowByte.call( this ) ;
  this._doReadCallback( prevent ) ;
  return value ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype.readHighByte = function( prevent ) {
  var value = Register.prototype.readHighByte.call( this, value ) ;
  this._doReadCallback( prevent ) ;
  return value ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype.readPartial = function( offset, mask, prevent ) {
  var value = Register.prototype.readPartial.call( this, offset, mask ) ;
  this._doReadCallback( prevent ) ;
  return value ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype.readBit = function( bit, prevent ) {
  var value = Register.prototype.readBit.call( this, bit ) ;
  this._doReadCallback( prevent ) ;
  return value ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype.writeWord = function( value, prevent ) {
  Register.prototype.writeWord.call( this, value ) ;
  this._doWriteCallback( prevent ) ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype.writeLowByte = function( value, prevent ) {
  Register.prototype.writeLowByte.call( this, value ) ;
  this._doWriteCallback( prevent ) ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype.writeHighByte = function( value, prevent ) {
  Register.prototype.writeHighByte.call( this, value ) ;
  this._doWriteCallback( prevent ) ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype.writePartial = function( value, offset, mask, prevent ) {
  Register.prototype.writePartial.call( this, value, offset, mask ) ;
  this._doWriteCallback( prevent ) ;
} ;


/**
 * @param prevent this function don't call callback function if it's true.
 */
RegisterWithCallBack.prototype.writeBit = function( bit, value, prevent ) {
  Register.prototype.writeBit.call( this, bit, value ) ;
  this._doWriteCallback( prevent ) ;
} ;
