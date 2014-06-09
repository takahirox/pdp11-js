/**
 * Processor Status Word
 */

__jsimport( "pdp11/Register.js" ) ;


/**
 * @constructor
 */
function Psw( ) {
  this.register = new Register( ) ;
}

Psw.KERNEL_MODE = 0x0 ;
Psw.USER_MODE   = 0x3 ;

Psw._CURRENT_MODE_BIT  = 14 ;
Psw._PREVIOUS_MODE_BIT = 12 ;
Psw._PRIORITY_BIT      = 5 ;
Psw._TRAP_BIT          = 4 ;
Psw._N_BIT             = 3 ;
Psw._Z_BIT             = 2 ;
Psw._V_BIT             = 1 ;
Psw._C_BIT             = 0 ;

Psw._CURRENT_MODE_MASK  = 3 ;
Psw._PREVIOUS_MODE_MASK = 3 ;
Psw._PRIORITY_MASK      = 7 ;
Psw._TRAP_MASK          = 1 ;
Psw._N_MASK             = 1 ;
Psw._Z_MASK             = 1 ;
Psw._V_MASK             = 1 ;
Psw._C_MASK             = 1 ;


/**
 * @return
 */
Psw.prototype.getC = function( ) {
  return this.register.readPartial( Psw._C_BIT, Psw._C_MASK ) ;
} ;


/**
 * @param value boolean
 */
Psw.prototype.setC = function( value ) {
  this.register.writePartial( value ? Psw._C_MASK : 0, Psw._C_BIT, Psw._C_MASK ) ;
} ;


/**
 * @return
 */
Psw.prototype.getV = function( ) {
  return this.register.readPartial( Psw._V_BIT, Psw._V_MASK ) ;
} ;

/**
 * @param value boolean
 */
Psw.prototype.setV = function( value ) {
  this.register.writePartial( value ? Psw._V_MASK : 0, Psw._V_BIT, Psw._V_MASK ) ;
} ;


/**
 * @return
 */
Psw.prototype.getZ = function( ) {
  return this.register.readPartial( Psw._Z_BIT, Psw._Z_MASK ) ;
} ;


/**
 * @param value boolean
 */
Psw.prototype.setZ = function( value ) {
  this.register.writePartial( value ? Psw._Z_MASK : 0, Psw._Z_BIT, Psw._Z_MASK ) ;
} ;


/**
 * @return
 */
Psw.prototype.getN = function( ) {
  return this.register.readPartial( Psw._N_BIT, Psw._N_MASK ) ;
} ;


/**
 * @param value boolean
 */
Psw.prototype.setN = function( value ) {
  this.register.writePartial( value ? Psw._N_MASK : 0, Psw._N_BIT, Psw._N_MASK ) ;
} ;


/**
 * @return
 */
Psw.prototype.getTrap = function( ) {
  return this.register.readPartial( Psw._TRAP_BIT, Psw._TRAP_MASK ) ;
} ;


/**
 * @param value
 */
Psw.prototype.setTrap = function( value ) {
  this.register.writePartial( value ? Psw._TRAP_MASK : 0, Psw._TRAP_BIT, Psw._TRAP_MASK ) ;
} ;


/**
 * @return
 */
Psw.prototype.getPriority = function( ) {
  return this.register.readPartial( Psw._PRIORITY_BIT, Psw._PRIORITY_MASK ) ;
} ;


/**
 * @param value 0-7
 */
Psw.prototype.setPriority = function( value ) {
  this.register.writePartial( value, Psw._PRIORITY_BIT, Psw._PRIORITY_MASK ) ;
} ;


/**
 * @return
 */
Psw.prototype.getPreviousMode = function( ) {
  return this.register.readPartial( Psw._PREVIOUS_MODE_BIT, Psw._PREVIOUS_MODE_MASK ) ;
} ;


/**
 * @param value 00b or 11b
 */
Psw.prototype.setPreviousMode = function( value ) {
  this.register.writePartial( value, Psw._PREVIOUS_MODE_BIT, Psw._PREVIOUS_MODE_MASK ) ;
} ;


/**
 * @return
 */
Psw.prototype.getCurrentMode = function( ) {
  return this.register.readPartial( Psw._CURRENT_MODE_BIT, Psw._CURRENT_MODE_MASK ) ;
} ;


/**
 * @param value 00b or 11b
 */
Psw.prototype.setCurrentMode = function( value ) {
  this.register.writePartial( value, Psw._CURRENT_MODE_BIT, Psw._CURRENT_MODE_MASK ) ;
} ;


/**
 * @return
 */
Psw.prototype.dump = function( ) {
  var buffer = '' ;
  buffer += 'cur_mode:' + this.getCurrentMode( ) ;
  buffer += ' ' ;
  buffer += 'pre_mode:' + this.getPreviousMode( ) ;
  buffer += ' ' ;
  buffer += 'pri:' + this.getPriority( ) ;
  buffer += ' ' ;
  buffer += this.getN( ) ? 'n' : '-' ;
  buffer += this.getZ( ) ? 'z' : '-' ;
  buffer += this.getV( ) ? 'v' : '-' ;
  buffer += this.getC( ) ? 'c' : '-' ;
  return buffer ;
} ;


/**
 *
 */
Psw.prototype.reset = function( ) {
  this.register.writeWord( 0 ) ;
} ;


/**
 * @return
 */
Psw.prototype.currentModeIsKernel = function( ) {
  return this.getCurrentMode( ) == Psw.KERNEL_MODE ? true : false ;
} ;


/**
 * @return
 */
Psw.prototype.previousModeIsKernel = function( ) {
  return this.getPreviousMode( ) == Psw.KERNEL_MODE ? true : false ;
} ;


/**
 * @return
 */
Psw.prototype.readWord = function( ) {
  return this.register.readWord( ) ;
} ;


/**
 * @return
 */
Psw.prototype.readLowByte = function( ) {
  return this.register.readLowByte( ) ;
} ;


/**
 * @param
 */
Psw.prototype.writeWord = function( value ) {
  this.register.writeWord( value ) ;
} ;
