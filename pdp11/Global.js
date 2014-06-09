__jsimport( "utility/Logger.js" ) ;
__jsimport( "utility/ConsoleLogger.js" ) ;
__jsimport( "utility/FileLogger.js" ) ;

var __displayview ;
var __logview ;
var __lognum ;
var __the_number_of_registers = 8 ;
var __num_format = 16 ;
var __num_digit = 4 ;
var __the_number_of_APRs = 8 ;
var __memory_capacity = 1024 * 18 * 8 ;
var __logger = new BlobLogger( Logger.NONE_LEVEL ) ;
//var __logger = new FileLogger( "C:\pdp11.log" ) ;

