(function ( root, factory ) {
  if ( typeof exports === 'object' ) {
    module.exports = factory();
  }
  else if ( typeof define === 'function' && define.amd ) {
    define( [], factory );
  }
  else {
    kettstreet = factory();
  }
}( this, function () {

  /*
   * kettstreet.js 0.0.0, a JavaScript OPeNDAP client.
   *
   * Contains original code from
   *
   *   http://jsdap.googlecode.com/svn/trunk/
   *     (c) 2007--2009 Roberto De Almeida
   */

  var atomicTypes = ['byte',
                     'int',
                     'uint',
                     'int16',
                     'uint16',
                     'int32',
                     'uint32',
                     'float32',
                     'float64',
                     'string',
                     'url',
                     'alias'];
  var structures = ['Sequence', 'Structure', 'Dataset'];

  Array.prototype.contains = function ( item ) {
    for ( var i = 0, el = this[i]; i < this.length; el = this[++i] ) {
      if ( item == el ) {
        return true;
      }
    }
    return false;
  };

  String.prototype.trim = function () {
    return this.replace( /^\s+|\s+$/g, '' );
  };

  String.prototype.ltrim = function () {
    return this.replace( /^[\s\n\r\t]+/, '' );
  };

  String.prototype.rtrim = function () {
    return this.replace( /\s+$/, '' );
  };

  function pseudoSafeEval( str ) {
    if ( /^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/.test( str.
                                                        replace( /\\./g, '@' ).
                                                        replace( /"[^"\\\n\r]*"/g, '' ) ) ) {
      return eval( '(' + str + ')' );
    }
    return str;
  }

  function DapType( type ) {
    this.type = type;
    this.attributes = {};
  }

  function SimpleParser( input ) {
    this.stream = input;

    this.peek = function ( expr ) {
      var regExp = new RegExp( '^' + expr, 'i' );
      var m = this.stream.match( regExp );
      if ( m ) {
        return m[0];
      }
      else {
        return '';
      }
    };

    this.consume = function ( expr ) {
      var regExp = new RegExp( '^' + expr, 'i' );
      var m = this.stream.match( regExp );
      if ( m ) {
        this.stream = this.stream.substr( m[0].length ).ltrim();
        return m[0];
      }
      else {
        throw new Error( "Unable to parse stream: " + this.stream.substr( 0, 10 ) );
      }
    };
  }

  function DDSParser( dds ) {
    this.stream = this.dds = dds;

    this._dataset = function () {
      var dataset = new DapType( 'Dataset' );

      this.consume( 'Dataset' );
      this.consume( '{' );
      while ( !this.peek( '}' ) ) {
        var declaration = this._declaration();
        dataset[declaration.name] = declaration;
      }
      this.consume( '}' );

      dataset.id = dataset.name = this.consume( '[^;]+' );
      this.consume( ';' );

      // Set id.
      function walk( dapvar, includeParent ) {
        for ( var attr in dapvar ) {
          var child = dapvar[attr];
          if ( child.type ) {
            child.id = child.name;
            if ( includeParent ) {
              child.id = dapvar.id + '.' + child.id;
            }
            walk( child, true );
          }
        }
      }

      walk( dataset, false );

      return dataset;
    };
    this.parse = this._dataset;

    this._declaration = function () {
      var type = this.peek( '\\w+' ).toLowerCase();
      switch ( type ) {
        case 'grid'     :
          return this._grid();
        case 'structure':
          return this._structure();
        case 'sequence' :
          return this._sequence();
        default         :
          return this._base_declaration();
      }
    };

    this._base_declaration = function () {
      var baseType = new DapType();

      baseType.type = this.consume( '\\w+' );
      baseType.name = this.consume( '\\w+' );

      baseType.dimensions = [];
      baseType.shape = [];
      while ( !this.peek( ';' ) ) {
        this.consume( '\\[' );
        var token = this.consume( '\\w+' );
        if ( this.peek( '=' ) ) {
          baseType.dimensions.push( token );
          this.consume( '=' );
          token = this.consume( '\\d+' );
        }
        baseType.shape.push( parseInt( token ) );
        this.consume( '\\]' );
      }
      this.consume( ';' );

      return baseType;
    };

    this._grid = function () {
      var grid = new DapType( 'Grid' );

      this.consume( 'grid' );
      this.consume( '{' );

      this.consume( 'array' );
      this.consume( ':' );
      grid.array = this._base_declaration();

      this.consume( 'maps' );
      this.consume( ':' );
      grid.maps = {};
      while ( !this.peek( '}' ) ) {
        var map_ = this._base_declaration();
        grid.maps[map_.name] = map_;
      }
      this.consume( '}' );

      grid.name = this.consume( '\\w+' );
      this.consume( ';' );

      return grid;
    };

    this._sequence = function () {
      var sequence = new DapType( 'Sequence' );

      this.consume( 'sequence' );
      this.consume( '{' );
      while ( !this.peek( '}' ) ) {
        var declaration = this._declaration();
        sequence[declaration.name] = declaration;
      }
      this.consume( '}' );

      sequence.name = this.consume( '\\w+' );
      this.consume( ';' );

      return sequence;
    };

    this._structure = function () {
      var structure = new DapType( 'Structure' );

      this.consume( 'structure' );
      this.consume( '{' );
      while ( !this.peek( '}' ) ) {
        var declaration = this._declaration();
        structure[declaration.name] = declaration;
      }
      this.consume( '}' );

      structure.name = this.consume( '\\w+' );
      this.consume( ';' );

      return structure;
    };
  }

  DDSParser.prototype = new SimpleParser;

  function DASParser( das, dataset ) {
    this.stream = this.das = das;
    this.dataset = dataset;

    this._attributes = function () {
      this._target = this.dataset;

      this.consume( 'attributes' );
      this.consume( '{' );
      while ( !this.peek( '}' ) ) {
        this._attr_container();
      }
      this.consume( '}' );

      return this.dataset;
    };
    this.parse = this._attributes;

    this._attr_container = function () {
      if ( atomicTypes.contains( this.peek( '\\w+' ).toLowerCase() ) ) {
        this._attribute( this._target.attributes );

        if ( this._target.type == 'Grid' ) {
          for ( map in this._target.maps ) {
            if ( this.dataset[map] ) {
              var map = this._target.maps[map];
              for ( name in map.attributes ) {
                this.dataset[map].attributes[name] = map.attributes[name];
              }
            }
          }
        }
      }
      else {
        this._container();
      }
    };

    this._container = function () {
      var name = this.consume( '[\\w_\\.]+' );
      this.consume( '{' );

      if ( name.indexOf( '.' ) > -1 ) {
        var names = name.split( '.' );
        var target = this._target;
        for ( var i = 0; i < names.length; i++ ) {
          this._target = this._target[names[i]];
        }

        while ( !this.peek( '}' ) ) {
          this._attr_container();
        }
        this.consume( '}' );

        this._target = target;
      }
      else if ( (structures.contains( this._target.type )) && (this._target[name]) ) {
        var target = this._target;
        this._target = target[name];

        while ( !this.peek( '}' ) ) {
          this._attr_container();
        }
        this.consume( '}' );

        this._target = target;
      }
      else {
        this._target.attributes[name] = this._metadata();
        this.consume( '}' );
      }
    };

    this._metadata = function () {
      var output = {};
      while ( !this.peek( '}' ) ) {
        if ( atomicTypes.contains( this.peek( '\\w+' ).toLowerCase() ) ) {
          this._attribute( output );
        }
        else {
          var name = this.consume( '\\w+' );
          this.consume( '{' );
          output[name] = this._metadata();
          this.consume( '}' );
        }
      }
      return output;
    };

    this._attribute = function ( object ) {
      var type = this.consume( '\\w+' );
      var name = this.consume( '\\w+' );

      var values = [];
      while ( !this.peek( ';' ) ) {
        var value = this.consume( '".*?[^\\\\]"|[^;,]+' );

        if ( (type.toLowerCase() == 'string') ||
             (type.toLowerCase() == 'url') ) {
          //value = pseudoSafeEval( value );
        }
        else if ( type.toLowerCase() == 'alias' ) {
          var target, tokens;
          if ( value.match( /^\\./ ) ) {
            tokens = value.substring( 1 ).split( '.' );
            target = this.dataset;
          }
          else {
            tokens = value.split( '.' );
            target = this._target;
          }

          for ( var i = 0; i < tokens.length; i++ ) {
            var token = tokens[i];
            if ( target[token] ) {
              target = target[token];
            }
            else if ( target.array.name == token ) {
              target = target.array;
            }
            else if ( target.maps[token] ) {
              target = target.maps[token];
            }
            else {
              target = target.attributes[token];
            }
            value = target;
          }
        }
        else {
          if ( value.toLowerCase() == 'nan' ) {
            value = NaN;
          }
          else {
            //value = pseudoSafeEval( value );
          }
        }
        values.push( value );
        if ( this.peek( ',' ) ) {
          this.consume( ',' );
        }
      }
      this.consume( ';' );

      if ( values.length == 1 ) {
        values = values[0];
      }

      object[name] = values;
    };
  }

  DASParser.prototype = new SimpleParser;

  function DAPParser( xdrdata, dapvar ) {

    this._buf = xdrdata;
    this.dapvar = dapvar;

    this._pos = 0;

    this.getValue = function () {
      var type = this.dapvar.type.toLowerCase();
      if ( type == 'structure' || type == 'dataset' ) {
        var out = [], tmp;
        dapvar = this.dapvar;
        for ( var child in dapvar ) {
          if ( dapvar[child].type ) {
            this.dapvar = dapvar[child];
            tmp = this.getValue();
            out.push( {das: this.dapvar, data: tmp} );
          }
        }
        this.dapvar = dapvar;
        return out;
      }
      else if ( type == 'grid' ) {
        var out = [], tmp;
        dapvar = this.dapvar;
        this.dapvar = dapvar.array;
        tmp = this.getValue();
        out.push( {das: this.dapvar, data: tmp} );
        for ( var map in dapvar.maps ) {
          this.dapvar = dapvar.maps[map];
          tmp = this.getValue();
          out.push( {das: this.dapvar, data: tmp} );
        }
        this.dapvar = dapvar;
        return out;
      }
      else if ( type == 'sequence' ) {
        var mark = this._unpack_uint32();
        var out = [], struct, tmp;
        var dapvar = this.dapvar;
        while ( mark != 2768240640 ) {
          struct = [];
          for ( var child in dapvar ) {
            if ( dapvar[child].type ) {
              this.dapvar = dapvar[child];
              tmp = this.getValue();
              struct.push( tmp );
            }
          }
          out.push( struct );
          mark = this._unpack_uint32();
        }
        this.dapvar = dapvar;
        return out;
         /*
         // This is a request for a base type variable inside a
         // sequence.

         } else if (this._buf.slice(i, i+4) == START_OF_SEQUENCE) {
         var mark = this._unpack_uint32();
         var out = [], tmp;
         while (mark != 2768240640) {
         tmp = this.getValue();
         out.push(tmp);
         mark = this._unpack_uint32();
         }
         return out;
         */
      }

      var n = 1;
      if ( this.dapvar.shape.length ) {
        n = this._unpack_uint32();
        if ( type != 'url' && type != 'string' ) {
          this._unpack_uint32();
        }
      }

      var out;
      if ( type == 'byte' ) {
        out = this._unpack_bytes( n );
      }
      else if ( type == 'url' || type == 'string' ) {
        out = this._unpack_string( n );
      }
      else {
        out = [];
        var func;
        switch ( type ) {
          case 'float32':
            func = '_unpack_float32';
            break;
          case 'float64':
            func = '_unpack_float64';
            break;
          case 'int'    :
            func = '_unpack_int32';
            break;
          case 'uint'   :
            func = '_unpack_uint32';
            break;
          case 'int16'  :
            func = '_unpack_int16';
            break;
          case 'uint16' :
            func = '_unpack_uint16';
            break;
          case 'int32'  :
            func = '_unpack_int32';
            break;
          case 'uint32' :
            func = '_unpack_uint32';
            break;
        }
        for ( var i = 0; i < n; i++ ) {
          out.push( this[func]() );
        }
      }

      if ( this.dapvar.shape ) {
        out = reshape( out, this.dapvar.shape );
      }
      else {
        out = out[0];
      }

      return out;
      //return {das: this.dapvar, data: out}
    };

    this._unpack_byte = function () {
      var i = this._pos;
      this._pos = i + 1;
      return this._buf.getUint8( i, false );
    };

    this._unpack_uint16 = function () {
      var i = this._pos;
      this._pos = i + 4;
      return this._buf.getUint16( i, false );
    };

    this._unpack_uint32 = function () {
      var i = this._pos;
      this._pos = i + 4;
      return this._buf.getUint32( i, false );
    };

    this._unpack_int16 = function () {
      var i = this._pos;
      this._pos = i + 4;
      return this._buf.getInt16( i, false );
    };

    this._unpack_int32 = function () {
      var i = this._pos;
      this._pos = i + 4;
      return this._buf.getInt32( i, false );
    };

    this._unpack_float32 = function () {
      var i = this._pos;
      this._pos = i + 4;
      return this._buf.getFloat32( i, false );
    };

    this._unpack_float64 = function () {
      var i = this._pos;
      this._pos = i + 8;
      return this._buf.getFloat64( i, false );
    };

    this._unpack_bytes = function ( count ) {
      var i = this._pos;
      var out = [];
      for ( var c = 0; c < count; c++ ) {
        out.push( this._unpack_byte() );
      }
      var padding = (4 - (count % 4)) % 4;
      this._pos = i + count + padding;

      return out;
    };

    this._unpack_string = function ( count ) {
      /*
       var out = [];
       var n, i, j;
       for (var c=0; c<count; c++) {
       n = this._unpack_uint32();
       i = this._pos;
       data = this._buf.slice(i, i+n);

       padding = (4 - (n % 4)) % 4;
       this._pos = i + n + padding;

       // convert back to string
       var str = '';
       for (var i=0; i<n; i++) {
       str += String.fromCharCode(data[i]);
       }
       out.push(str);
       }

       return out;
       */
    };
  }

  function reshape( array, shape ) {
    if ( !shape.length ) {
      return array[0];
    }
    var out = [];
    var size, start, stop;
    for ( var i = 0; i < shape[0]; i++ ) {
      size = array.length / shape[0];
      start = i * size;
      stop = start + size;
      out.push( reshape( array.slice( start, stop ), shape.slice( 1 ) ) );
    }
    return out;
  };

  var Kettstreet = (function () {

    var Kettstreet = function ( options ) {
      this.options = options;
    };

    Kettstreet.prototype.header = function ( data ) {
      var dods = new DataView( data );
      var dds = '';
      for ( var i = 0; i < dods.byteLength && !dds.match( /\nData:\n$/ ); i++ ) {
        dds += String.fromCharCode( dods.getUint8( i ) );
      }

      if ( dds.match( /\nData:\n$/ ) ) {
        return {
          length: dds.length,
          text  : dds.substr( 0, dds.length - 7 )
        }
      }
      else {
        return {
          length: dds.length,
          text  : dds
        }
      }
    };

    Kettstreet.prototype.dds = function ( callback ) {
      var self = this;
      if ( self._dds ) {
        callback( undefined, self._dds );
      }
      else {
        this.options.provider( this.options.url + ".dds", function ( err, data ) {
          if ( err ) {
            callback( err );
          }
          else {
            self._dds = new DDSParser( self.header( data ).text ).parse();
            callback( undefined, self._dds );
          }
        } );
      }
    };

    Kettstreet.prototype.das = function ( callback ) {
      var self = this;
      if ( self._das ) {
        callback( undefined, self._das );
      }
      else {
        self.dds( function ( err, dds ) {
          self.options.provider( self.options.url + ".das", function ( err, data ) {
            if ( err ) {
              callback( err );
            }
            else {
              self._das = new DASParser( self.header( data ).text, dds ).parse();
              callback( undefined, self._das );
            }
          } );
        } );
      }
    };

    Kettstreet.prototype.dim = function ( variable, callback ) {
      var self = this;
      if ( self["_" + variable] ) {
        callback( undefined, self["_" + variable] );
      }
      else {
        self.das( function ( err, das ) {
          var url = self.options.url + ".dods?" + variable;
          self.options.provider( url, function ( err, data ) {
            if ( err ) {
              callback( err );
            }
            else {
              var header = self.header( data );
              var das = new DDSParser( header.text ).parse();
              var dap = new DAPParser( new DataView( data.slice( header.length ) ), das ).getValue();
              self["_" + variable] = dap;
              callback( undefined, self["_" + variable] );
            }
          } );
        } );
      }
    };

    Kettstreet.prototype.dims = function ( variable, callback ) {
      var self = this;
      if ( self._dim ) {
        callback( undefined, self._dim );
      }
      else {
        self.das( function ( err, das ) {
          var url = self.options.url + ".dods?" + das[variable].array.dimensions.join( ',' );
          self.options.provider( url, function ( err, data ) {
            if ( err ) {
              callback( err );
            }
            else {
              var header = self.header( data );
              var das = new DDSParser( header.text ).parse();
              var dap = new DAPParser( new DataView( data.slice( header.length ) ), das ).getValue();
              self._dim = dap;
              callback( undefined, self._dim );
            }
          } );
        } );
      }
    };

    Kettstreet.prototype.dap = function ( variable, query, callback ) {

      var find = function( arr, callback ) {
        for ( var i = 0, len = arr.length; i < len; i++ ) {
          if( callback( arr[i] ) ) {
            return arr[i];
          }
        }
        return null;
      };

      var findLastIndex = function( arr, callback ) {
        for ( var i = arr.length - 1; i > 0; --i ) {
          if( callback( arr[i] ) ) {
            return i;
          }
        }
        return -1;
      };

      var findFirstIndex = function( arr, callback ) {
        for ( var i = 0, len = arr.length; i < len; ++i ) {
          if( callback( arr[i] ) ) {
            return i;
          }
        }
        return -1;
      };

      var findData = function ( dim, name ) {
        return find( dim, function ( i ) { return i.das.name == name } ).data;
      };

      var params = function ( das, dim ) {
        var p = [];
        for ( var i = 0; i < das[variable].array.dimensions.length; i++ ) {
          var name = das[variable].array.dimensions[i];
          var data = findData( dim, name );

          var a = query[name].min ? Math.max( findLastIndex( data, function ( i ) {
            return i <= query[name].min
          } ), 0 ) : 0;
          var b = query[name].max ? Math.min( findLastIndex( data, function ( i ) {
            return i <= query[name].max
          } ), ( data.length - 1 ) ) : ( data.length - 1 );

          p.push( "[" + a + ":" + ( query[name].step || 1 ) + ":" + b + "]" )
        }
        return p.join("");
      };

      var self = this;
      self.das( function ( err, das ) {
        self.dims( variable, function ( err, dim ) {
          var url = self.options.url + ".dods?" + variable + params( das, dim );
          self.options.provider( url, function ( err, data ) {
            if ( err ) {
              callback( err );
            }
            else {
              var header = self.header( data );
              var das = new DDSParser( header.text ).parse();
              var dap = new DAPParser( new DataView( data.slice( header.length ) ), das ).getValue();
              callback( undefined, dap );
            }
          } );
        } );
      } );
    };

    return Kettstreet;
  })();

  return function ( options ) {
    return new Kettstreet( options );
  };

} ));