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

/*
var t_sfc = kettstreet( {
  url     : "http://localhost:8080/firemod/dodsC/bom/IDV71000_VIC_T_SFC.nc",
  provider: provider
} );
var variable = "T_SFC";
var query = {
  time     : {
    min : moment().add(1,'day').startOf( 'day' ).unix(),
    max : moment().add(1,'day').startOf( 'day' ).unix(),
    step: 1
  },
  latitude : {},
  longitude: {}
};

t_sfc.dap( variable, query, function ( err, data ) {
  if ( err ) {
    console.log( err );
  }
  else {
    console.log( util.inspect( data, false, 1 ) );
  }
} );

kettstreet( {
  url     : "http://test.opendap.org:8080/opendap/hyrax/data/nc/test.nc",
  provider: provider
} ).das( function ( err, data ) {
  if ( err ) {
    console.log( err );
  }
  else {
    console.log( util.inspect( data, false, 5 ) );
  }
} );


kettstreet( {
  url     : "http://test.opendap.org:8080/opendap/hyrax/data/nc/data.nc",
  provider: provider
} ).das( function ( err, data ) {
  if ( err ) {
    console.log( err );
  }
  else {
    console.log( util.inspect( data, false, 5 ) );
  }
} );
*/
