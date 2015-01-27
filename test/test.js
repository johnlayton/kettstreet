var kettstreet = require( '../kettstreet' );
var request = require( 'request' );
var util = require( 'util' );
var moment = require( 'moment' );
var tape = require( 'tape' );

var provider = function ( url, callback ) {
  function arraybuffer( buffer ) {
    var ab = new ArrayBuffer( buffer.length );
    var ar = new Uint8Array( ab );
    var dv = new DataView( ab );
    for ( var i = 0; i < buffer.length; ++i ) {
      dv.setUint8( i, buffer.readUInt8( i ) );
    }
    return ab;
  }
  request( url, {encoding: null}, function ( err, res, body ) {
    callback( err, arraybuffer( body ) );
  } );
};
kett = kettstreet( {
  url     : "http://test.opendap.org/dap/data/nc/data.nc",
  provider: provider
} );

tape( 'check das', function ( test ) {
  kett.dds( function ( err, data ) {
    test.plan( 1 );
    test.equal( data.type, "Dataset" );
  } );
} );

tape( 'check das', function ( test ) {
  kett.das( function ( err, data ) {
    test.plan( 1 );
    test.equal( data.type, "Dataset" );
  } );
} );

tape( 'check dap', function ( test ) {
  kett.dap( "SST", {}, function ( err, data ) {
    test.plan( 1 );
    test.equal( data[0].das.type, "Grid" );
  } );
} );
