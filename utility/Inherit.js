function __inherit( p ) {
  if( Object.create ) {
    return Object.create( p ) ;
  }

  function f( ) { } ;
  f.prototype = p ;
  return new f( ) ;
}
