__jsimport( "pdp11/SystemCall.js" ) ;

function Disassembler( pdp11 ) {
  this.pdp11 = pdp11 ;
}

Disassembler._operands = [
     'r',
    '(r)',
    '(r)+',
   '*(r)+',
   '-(r)',
  '*-(r)',
   'X(r)',
  '*X(r)'
] ;

Disassembler._operands2 = [
     '',
     '',
   '$X',
  '*$X',
     '',
     '',
    'X',
   '*X'
] ;

Disassembler.prototype._getOperand = function( num, pos ) {

  var reg_num = num & 07 ;
  var mode    = ( num & 070 ) >> 3 ;
  var buffer  = '' ;
  var code    = '' ;

  if( reg_num == 7 && Disassembler._operands2[ mode ] != '' ) {
    buffer = Disassembler._operands2[ mode ] ;
  } else {
    buffer = Disassembler._operands[ mode ].replace( 'r', 'r' + reg_num ) ;
  }

  if( buffer.indexOf( 'X' ) >= 0 ) {
    code = format( this.pdp11.mmu.loadWord( this.pdp11._getPc( ).readWord( ) + pos ) ) ;
    buffer = buffer.replace( 'X', code ) ;
    pos += 2 ;
  }

  return { 'buffer' : buffer, 'pos' : pos, 'code' : code } ;

} ;

Disassembler.prototype.run = function( op, code ) {

  var buffer = '' ;
  var opr1, opr2 ;
  var pos = 0 ;

  switch ( op.type ) {

    case OpType.I_DOUBLE:
      opr1 = this._getOperand( ( code & 0007700 ) >> 6, pos ) ;
      opr2 = this._getOperand( code & 0000077, opr1.pos ) ;
      buffer += op.op + ' ' + opr1.buffer + ', ' + opr2.buffer ;
      return buffer ;

    case OpType.I_SINGLE:
      opr1 = this._getOperand( code & 0000077, pos ) ;
      buffer += op.op + ' ' + opr1.buffer ;
      return buffer ;

    case OpType.I_BRANCH:
      var opr1 = code & 0177 ;
      if( code & 0200 )
        opr1 *= -1 ;
      buffer += op.op + ' ' + format( opr1 * 2 ) ;
      buffer += ' ! ' + format( to_uint16( opr1 * 2 + this.pdp11._getPc( ).readWord( ) ) ) ;
      return buffer ;

    case OpType.I_CONDITION:
      buffer += op.op ;
      return buffer ;

    case OpType.I_JSR:
      opr1 = this._getOperand( ( code & 0000700 ) >> 6, pos ) ;
      opr2 = this._getOperand( code & 0000077, opr1.pos ) ;
      buffer += op.op + ' ' + opr1.buffer + ', ' + opr2.buffer ;
      return buffer ;

    case OpType.I_RTS:
      opr1 = this._getOperand( code & 0000007, pos ) ;
      buffer += op.op + ' ' + opr1.buffer ;
      return buffer ;

    case OpType.I_JMP:
      opr1 = this._getOperand( code & 0000077, pos ) ;
      buffer += op.op + ' ' + opr1.buffer ;
      return buffer ;

    case OpType.I_OTHER:
      buffer += op.op ;
      return buffer ;

    case OpType.I_ONEHALF:
      opr1 = this._getOperand( ( code & 0000700 ) >> 6, pos ) ;
      opr2 = this._getOperand( ( code & 0000077 ), opr1.pos ) ;
      buffer += op.op + ' ' + opr1.buffer + ', ' + opr2.buffer ;
      return buffer ;

    // not implemented yet.
    case OpType.I_SYSTEM:
      buffer += op.op + " " + format( code & 0xff ) + ':' + SystemCall[ code & 0xff ].name ;
      if( ( code & 0xff ) == 0 ) {
        var tmp = this.pdp11.mmu.loadWord( this.pdp11._getPc( ).readWord( ) ) ;
        var sys_op = this.pdp11.mmu.loadWord( tmp ) ;
        buffer += '(' + SystemCall[ sys_op & 0xff ].name + ')' ;
      }
      return buffer ;

    default:
      return buffer ;

  }

} ;
