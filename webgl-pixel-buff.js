/**
	IBNIZ-js WebGL
	WebGL Pixel Buffer handling services
*/
(function(){
window.WebglPixelBuff = function(){
	var gl = null;
	var g_width = 0;
	var g_height = 0;
	var g_texture = null;
	var g_textureLoc = -1;
	var g_programObject = null;
	var g_vbo = null;
	var g_texCoordOffset=0;
	this.debugMode=false;
	
	this.init=function(canvasid){
		initWebgl(canvasid);
		initShaders();
	}
	
	function initWebgl(canvasid) {
		var c = document.getElementById(canvasid);

		c.addEventListener('webglcontextlost', handleContextLost, false);
		c.addEventListener('webglcontextrestored', handleContextRestored, false);

		gl = WebGLUtils.setupWebGL(c);
		if (!gl)
			return;
		g_width = c.width;
		g_height = c.height;
	}
	this.initWebgl=initWebgl;

	function log(msg) {
		if (window.console && window.console.log) {
			console.log(msg);
		}
	}

	function handleContextLost(e) {
		log("handle context lost");
		e.preventDefault();
	}

	function handleContextRestored() {
		log("handle context restored");
		init();
	}

	function clear(){
		gl.clearColor(0., 0., 0., 1.);
	}
	this.clear=clear;
	
	function checkGLError() {
		if(this.debugMode){
			var error = gl.getError();
			if (error != gl.NO_ERROR && error != gl.CONTEXT_LOST_WEBGL) {
				var str = "GL Error: " + error;
				document.body.appendChild(document.createTextNode(str));
				throw str;
			}
		}
	}

	function loadShader(type, shaderSrc) {
		var shader = gl.createShader(type);
		// Load the shader source
		gl.shaderSource(shader, shaderSrc);
		// Compile the shader
		gl.compileShader(shader);
		// Check the compile status
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) &&
			!gl.isContextLost()) {
			var infoLog = gl.getShaderInfoLog(shader);
			alert("Error compiling shader:\n" + infoLog);
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	function initShaders() {
		var vShaderStr = [
			"attribute vec2 g_Position;",
			"attribute vec2 g_TexCoord0;",
			"varying vec2 texCoord;",
			"void main()",
			"{",
			"gl_Position = vec4(g_Position, 0, 1);",
			"   texCoord = g_TexCoord0;",
			"}"
		].join("\n");
		
		var fShaderStr2 = [
		  'precision mediump float;',
		  'uniform sampler2D tex;',
		  'varying vec2 texCoord;',
		  'uniform mat4 YUV2RGB;',

		  'void main(void) {',
			  'vec4 t = texture2D(tex, texCoord);',
			  'vec4 yuv1=vec4(t.g, t.b, t.a, 1);',
			  'vec4 rgb = (yuv1*YUV2RGB);',
			  'gl_FragColor = vec4(rgb[0]/256.0,rgb[1]/256.0,rgb[2]/256.0,1.0);',
		  '}'
		].join('\n');
  
  
  /**
  On older, non-SIMD architectures, floating point arithmetic is much slower than using fixed-point arithmetic, so an alternative formulation is:

    C = Y' - 16 
	D = U - 128 
	E = V - 128

Using the previous coefficients and noting that clamp() denotes clamping a value to the range of 0 to 255, the following formulae provide the conversion from Y'UV to RGB (NTSC version):

    R = clamp(( 298 x C + 409 x E + 128) >> 8) 
	G = clamp(( 298 x C - 100 x D - 208 x E + 128) >> 8)
	B = clamp(( 298 x C + 516 x D + 128) >> 8)
	
  */
		var YUV2RGB = [
					298.0,    0.0, 409.0, 		(-128+16)/256.0*298.0-0.5*(0.0+409.0)	+128.0,
					298.0,  -100.0 , -208.0,	(-128+16)/256.0*298.0-0.5*(-100.0-208.0)	+128.0,
					298.0, 516.0, 0.0, 			(-128+16)/256.0*298.0-0.5*(516.0+0.0)	+128.0,
					0.0,0.0,0.0,1.0
					];					
					
		var vertexShader = loadShader(gl.VERTEX_SHADER, vShaderStr);
		var fragmentShader = loadShader(gl.FRAGMENT_SHADER, fShaderStr2);
		// Create the program object
		var programObject = gl.createProgram();
		gl.attachShader(programObject, vertexShader);
		gl.attachShader(programObject, fragmentShader);
		// Bind g_Position to attribute 0
		// Bind g_TexCoord0 to attribute 1
		gl.bindAttribLocation(programObject, 0, "g_Position");
		gl.bindAttribLocation(programObject, 1, "g_TexCoord0");
		// Link the program
		gl.linkProgram(programObject);
		// Check the link status
		var linked = gl.getProgramParameter(programObject, gl.LINK_STATUS);
		if (!linked && !gl.isContextLost()) {
			var infoLog = gl.getProgramInfoLog(programObject);
			alert("Error linking program:\n" + infoLog);
			gl.deleteProgram(programObject);
			return;
		}
		g_programObject = programObject;
		g_textureLoc = gl.getUniformLocation(g_programObject, "tex");
			
		//view square
		g_vbo = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, g_vbo);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, -1, 1, 1]), gl.STATIC_DRAW);

		texBuff = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, texBuff);
		//upside down texture - due to GL  y axis direction
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]), gl.STATIC_DRAW);

		gl.useProgram(g_programObject);

		var YUV2RGBRef = gl.getUniformLocation(g_programObject, 'YUV2RGB');
		gl.uniformMatrix4fv(YUV2RGBRef, false, YUV2RGB);

		checkGLError();
	}

	function draw(data,width,height,dataFormat) {
		if(!dataFormat)dataFormat = gl.RGBA;
		//g_texture = createPixelTexture();
		g_texture = textureFromPixelArray(gl, data, dataFormat, width,height);
		// Clear the color buffer
		gl.clear(gl.COLOR_BUFFER_BIT);
		checkGLError();
		// Use the program object
		gl.useProgram(g_programObject);
		checkGLError();
		// Load the vertex data

		vloc = gl.getAttribLocation(g_programObject, "g_Position"); 
		tloc = gl.getAttribLocation(g_programObject, "g_TexCoord0");
		
		gl.enableVertexAttribArray(vloc);
		gl.bindBuffer(gl.ARRAY_BUFFER, g_vbo);
		gl.vertexAttribPointer(vloc, 2, gl.FLOAT, false, 0, 0);

		gl.enableVertexAttribArray(tloc);
		gl.bindBuffer(gl.ARRAY_BUFFER, texBuff);
		gl.bindTexture(gl.TEXTURE_2D, g_texture);
		gl.vertexAttribPointer(tloc, 2, gl.FLOAT, false, 0, 0);

		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
		
		checkGLError();
		// Point the uniform sampler to texture unit 0
		gl.uniform1i(g_textureLoc, 0);
		//checkGLError();
		
		//if(!g_texture)gl.deleteTexture(g_texture);
		gl.deleteTexture(g_texture);
	}
	this.draw=draw;
	
	/**
		@param dataArray Uint8Array
	*/
	function textureFromPixelArray(gl, dataArray, type, width, height) {
		//var dataTypedArray = new Uint8Array(dataArray); // Don't need to do this if the data is already in a typed array
		var dataTypedArray = dataArray;

		var texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		//gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);//texture rendering is flipped
		
		gl.texImage2D(gl.TEXTURE_2D, 0, type, width, height, 0, type, gl.UNSIGNED_BYTE, dataTypedArray);
		// Other texture setup here, like filter modes and mipmap generation
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); 
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); 
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		return texture;
	}

	/**
		test texture
	*/
	function createPixelTexture(){
		// RGB Texture:
		// For a 16x16 texture the array must have at least 768 values in it (16x16x3)
		var a=[];
		var i=0;
		for(var y=0;y<256;y++){
			for(var x=0;x<256;x++){
				a[i++] = x*y/256;
				a[i++] = (y*y)/256;
				a[i++] = Math.floor(Math.random()*256);
			}
		}
		var rgbTex = textureFromPixelArray(gl, a, gl.RGB, 256, 256);
		return rgbTex;
	}

	return this;
}
})(window);







