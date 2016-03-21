var kettstreet = require( '../kettstreet' );
var request = require( 'request' );
var util = require( 'util' );

var provider = function ( url, callback ) {
  console.log( url );
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
    console.log( body );
    callback( err, arraybuffer( body ) );
  } );
};

var vicroad = kettstreet( {
  url     : "http://localhost:5000/data/t_sfc.nc",
  provider: provider
} );

var firemod = kettstreet( {
  url     : "http://localhost:8080/firemod/dodsC/bom/IDV71000_VIC_T_SFC.nc",
  provider: provider
} );

var opendap = kettstreet( {
  url     : "http://test.opendap.org/dap/data/nc/data.nc",
  provider: provider
} );

//tape( 'check dds', function ( test ) {
//  kett.dds( function ( err, data ) {
//    test.plan( 1 );
//    test.equal( data.type, "Dataset" );
//  } );
//} );

var log = function ( err, data ) {
  console.log( util.inspect( data, false, 2 ) );
};

var problem = {
  time: { min: 1422918000, max: 1422918000, step: 1 },
  latitude:  { min: -37.91999816894531, max: -36.07999801635742, step: 10 },
  longitude: { min: 140.90289306640625, max: 150.651611328125, step: 10 }
};

var repl = require( 'repl' ).start( {
  prompt : " -> ",
  input  : process.stdin,
  output : process.stdout
} );
repl.context.log = log;
repl.context.vicroad = vicroad;
repl.context.firemod = firemod;
repl.context.opendap = opendap;
repl.context.dim = function(kett, name, idx) {
  kett.dim(name,function(err,data){console.log(idx ? data[0].data[idx] : data );})
};
repl.context.dds = function(kett) {
  kett.dds(function(err,data){console.log(data);})
};
repl.context.das = function(kett) {
  kett.das(function(err,data){console.log(data);})
};
repl.context.dap = function(kett, name, query) {
  kett.dap(name, query,function(err,data){
    //console.log( util.inspect( data[0].das, false, 3 ) );
    //console.log( util.inspect( data[0].das, false, 3 ) );
    console.log( util.inspect( data[0], false, 2 ) );
    console.log( util.inspect( data[0].das.maps, false, 3 ) );
    console.log( util.inspect( data[0].das.array, false, 3 ) );
    //console.log( util.inspect( data[0].data[0].data[0], false, 2 ) );
    //console.log( util.inspect( data[0].data[1].data, false, 2 ) );
    //console.log( util.inspect( data[0].data[2].data, false, 2 ) );
    //console.log( util.inspect( data[0].data[3].data, false, 2 ) );

    //require('fs').createWriteStream("/Users/john/Tenp/" + filename,)
  });
};
repl.context.test = function() {
  //repl.context.dap( repl.context.vicroad, 'T_SFC', "[76:1:76][0:10:50][0:10:50]" );
  //repl.context.dap( repl.context.firemod, 'T_SFC', "[76:1:76][0:10:50][0:10:50]" );
  repl.context.dap( repl.context.vicroad, 'T_SFC', "[76:1:76][0:20:282][0:20:327]" );
  repl.context.dap( repl.context.firemod, 'T_SFC', "[76:1:76][0:20:282][0:20:327]" );
};

//dap( vicroad, 'T_SFC', "[76:1:76][0:20:282][0:20:327]" );

//kett.dim("latitude",function(err,data){console.log(data);})
/*
*/
