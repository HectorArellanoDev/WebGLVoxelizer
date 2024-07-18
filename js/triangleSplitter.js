onmessage = function(e) {
    let id = e.data[0];
    let positions = e.data[1];
    let colors = e.data[2];
    let scale = e.data[3];
    postMessage(getVoxelMeshData(id, positions, colors, scale));

}

    ///////////////////////////////////////////////////////////////
    // This can be done in a thread in the CPU or we can do it
    // in the GPU simulating some sort of geometry shader.
    // this is useful to update the positions for skinned meshes.
    // Triangles should be splitting by at least the resolution of the voxelization
    ///////////////////////////////////////////////////////////////
    function splitTriangles(p, size, d = 1 / Math.pow(2, 6), dDiscard = 2.) {
        let v1 = new Vector3();
        let v2 = new Vector3();
        let v3 = new Vector3();
    
        let va = new Vector3();
        let vb = new Vector3();
        let vc = new Vector3();

        const MAX_SIZE = Math.pow(2, 27);
        let result = new Float32Array(MAX_SIZE);
        let uvs = new Float32Array(MAX_SIZE);

        let bigTriangles = [];
        let requireSplitting = false;

        let j = 0;
        let newPositionsSize = 0;
        let newUVsSize = 0;

        for (let i = 0; i < size; i += 9) {

            v1.set(p[i + 0], p[i + 1], p[i + 2]);
            v2.set(p[i + 3], p[i + 4], p[i + 5]);
            v3.set(p[i + 6], p[i + 7], p[i + 8]);

            let d1 = v1.distanceTo(v2);
            let d2 = v2.distanceTo(v3);
            let d3 = v3.distanceTo(v1);

            if ( Number(d1 > dDiscard ) + Number(d2 > dDiscard) + Number(d3 > dDiscard) > 0 ) {
            
                bigTriangles.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
            
            } else {

                let split = (d1 > d || d2 > d || d3 > d);

                requireSplitting = requireSplitting || split;

                if (split) {
                    va.set(p[i + 0], p[i + 1], p[i + 2]);
                    vb.set(p[i + 3], p[i + 4], p[i + 5]);
                    vc.set(p[i + 6], p[i + 7], p[i + 8]);
    
                    va = va.clone().add(v2).multiplyScalar(0.5);
                    vb = vb.clone().add(v3).multiplyScalar(0.5);
                    vc = vc.clone().add(v1).multiplyScalar(0.5);
    
                    result.set([v1.x, v1.y, v1.z, va.x, va.y, va.z, vc.x, vc.y, vc.z], newPositionsSize);
                    newPositionsSize += 9;
                    result.set([va.x, va.y, va.z, v2.x, v2.y, v2.z, vb.x, vb.y, vb.z], newPositionsSize);
                    newPositionsSize += 9;
                    result.set([vb.x, vb.y, vb.z, v3.x, v3.y, v3.z, vc.x, vc.y, vc.z], newPositionsSize);
                    newPositionsSize += 9;
                    result.set([va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z], newPositionsSize);
                    newPositionsSize += 9;

                } else {

                    result.set([v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z], newPositionsSize);
                    newPositionsSize += 9;
                }

            }

            j += 6;
        }


        return {
            result,
            bigTriangles,
            requireSplitting,
            newPositionsSize,
            newUVsSize
        }
    };

    ///////////////////////////////////////////////////////////////
    // Save positions and indices inside textures
    // this should be done in a thread, and updated if the mesh
    // is a skinned mesh. If done in the GPU it can use a MRT to
    // save the new vertex position to voxelize since the later
    // will use a texture.
    ///////////////////////////////////////////////////////////////
    function getVoxelMeshData(id, positions, colors, scale) {

        // console.log("the scale is: " + scale);

        positions = positions.map(pos => pos / scale);

        // console.log("initial amount of triangles: " + positions.length / 9);
                
        let split = true;
        let check = -1;
        let bigTriangles = [];
        let newSize = positions.length;
        let positionsData = new Float32Array(positions);
        while (split) {
            let data = splitTriangles(positionsData, newSize);
            newSize = data.newPositionsSize;
            check++;
            positionsData = data.result;
            if (data.bigTriangles.length > 0) {
                bigTriangles = data.bigTriangles;
                // console.log("triangles discarded by size: " + bigTriangles.length / 9);
            }
            split = data.requireSplitting;
        }

        positionsData = positionsData.map(pos => pos * scale);
        bigTriangles = bigTriangles.map(pos => pos * scale);


        let amountOfTriangles = newSize / 9;
        let textureSize = Math.ceil(Math.sqrt(newSize / 3));
        bigTriangles = new Float32Array(bigTriangles);

        // console.log("amount of splitting: " + check);
        // console.log("final amount of triangles: " + newSize / 9);
        // console.log("texture size: " + textureSize);
        // console.log("-----------------------------")

        return {id, positionsData, bigTriangles, amountOfTriangles, textureSize};
    }


    class Vector3 {
        constructor(x, y, z) {
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
        }
    
        /**
         * @name x
         * @memberof Vector3
         * @property
         */
    
        /**
         * @name y
         * @memberof Vector3
         * @property
         */
    
        /**
         * @name z
         * @memberof Vector3
         * @property
         */
    
        /**
         * @name set
         * @memberof Vector3
         *
         * @function
         * @param {Number} x
         * @param {Number} y
         * @param {Number} z
         * @return {Vector3}
         */
        set(x, y, z) {
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
    
            return this;
        }
    
        /**
         * @name setScalar
         * @memberof Vector3
         *
         * @function
         * @param {Number} s
         * @return {Vector3}
         */
        setScalar(scalar) {
            this.x = scalar;
            this.y = scalar;
            this.z = scalar;
    
            return this;
        }
    
        /**
         * @name clone
         * @memberof Vector3
         *
         * @function
         * @return {Vector3}
         */
        clone() {
            return new Vector3(this.x, this.y, this.z);
        }
    
        /**
         * @name this.copy
         * @memberof Vector3
         *
         * @function
         * @param v
        */
        copy(v) {
            this.x = v.x;
            this.y = v.y;
            this.z = v.z;
    
            return this;
        }
    
        /**
         * @name add
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} v
         * @return {Vector3}
         */
        add(v) {
            this.x += v.x;
            this.y += v.y;
            this.z += v.z;
    
            return this;
        }
    
        /**
         * @name addScalar
         * @memberof Vector3
         *
         * @function
         * @param {Number} s
         * @return {Vector3}
         */
        addScalar(s) {
            this.x += s;
            this.y += s;
            this.z += s;
    
            return this;
        }
    
        /**
         * @name addVectors
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} a
         * @param {Vector3} b
         * @return {Vector3}
         */
        addVectors(a, b) {
            this.x = a.x + b.x;
            this.y = a.y + b.y;
            this.z = a.z + b.z;
    
            return this;
        }
    
        /**
         * @name addScaledVector
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} v
         * @param {Number} s
         * @return {Vector3}
         */
        addScaledVector(v, s) {
            this.x += v.x * s;
            this.y += v.y * s;
            this.z += v.z * s;
    
            return this;
        }
    
        /**
         * @name sub
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} v
         * @return {Vector3}
         */
        sub(v) {
            this.x -= v.x;
            this.y -= v.y;
            this.z -= v.z;
    
            return this;
        }
    
        /**
         * @name subScalar
         * @memberof Vector3
         *
         * @function
         * @param {Number} s
         * @return {Vector3}
         */
        subScalar(s) {
            this.x -= s;
            this.y -= s;
            this.z -= s;
    
            return this;
        }
    
        /**
         * @name subVectors
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} a
         * @param {Vector3} b
         * @return {Vector3}
         */
        subVectors(a, b) {
            this.x = a.x - b.x;
            this.y = a.y - b.y;
            this.z = a.z - b.z;
    
            return this;
        }
    
        /**
         * @name multiply
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} v
         * @return {Vector3}
         */
        multiply(v) {
            this.x *= v.x;
            this.y *= v.y;
            this.z *= v.z;
    
            return this;
        }
    
        /**
         * @name multiplyScalar
         * @memberof Vector3
         *
         * @function
         * @param {Number} s
         * @return {Vector3}
         */
        multiplyScalar(scalar) {
            this.x *= scalar;
            this.y *= scalar;
            this.z *= scalar;
    
            return this;
        }
    
        /**
         * @name multiplyVectors
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} a
         * @param {Vector3} b
         * @return {Vector3}
         */
        multiplyVectors(a, b) {
            this.x = a.x * b.x;
            this.y = a.y * b.y;
            this.z = a.z * b.z;
    
            return this;
        }
    
        /**
         * @name applyEuler
         * @memberof Vector3
         *
         * @function
         * @param {Euler} euler
         * @return {Vector3}
         */
        applyEuler(euler) {
            let quaternion = this.Q1 || new Quaternion();
            this.Q1 = quaternion;
    
            return this.applyQuaternion( quaternion.setFromEuler( euler ) );
        }
    
        /**
         * @name applyAxisAngle
         * @memberof Vector3
         *
         * @function
         * @param {Number} axis
         * @param {Number} angle
         * @return {Vector3}
         */
        applyAxisAngle(axis, angle) {
            let quaternion = this.Q1 || new Quaternion();
            this.Q1 = quaternion;
    
            return this.applyQuaternion( quaternion.setFromAxisAngle( axis, angle ) );
        }
    
        /**
         * @name applyMatrix3
         * @memberof Vector3
         *
         * @function
         * @param {Matrix3} matrix
         * @return {Vector3}
         */
        applyMatrix3(m) {
            let x = this.x, y = this.y, z = this.z;
            let e = m.elements;
    
            this.x = e[ 0 ] * x + e[ 3 ] * y + e[ 6 ] * z;
            this.y = e[ 1 ] * x + e[ 4 ] * y + e[ 7 ] * z;
            this.z = e[ 2 ] * x + e[ 5 ] * y + e[ 8 ] * z;
    
            return this;
        }
    
        /**
         * @name applyMatrix4
         * @memberof Vector3
         *
         * @function
         * @param {Matrix4} matrix
         * @return {Vector3}
         */
        applyMatrix4(m) {
            let x = this.x, y = this.y, z = this.z;
            let e = m.elements;
    
            let w = 1 / ( e[ 3 ] * x + e[ 7 ] * y + e[ 11 ] * z + e[ 15 ] );
    
            this.x = ( e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z + e[ 12 ] ) * w;
            this.y = ( e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z + e[ 13 ] ) * w;
            this.z = ( e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z + e[ 14 ] ) * w;
    
            return this;
        }
    
        /**
         * @name applyQuaternion
         * @memberof Vector3
         *
         * @function
         * @param {Quaternion} q
         * @return {Vector3}
         */
        applyQuaternion(q) {
            let x = this.x, y = this.y, z = this.z;
            let qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    
            if (qx == 0 && qy == 0 && qz == 0 && qw == 1) return this;
    
            // calculate quat * vector
    
            let ix = qw * x + qy * z - qz * y;
            let iy = qw * y + qz * x - qx * z;
            let iz = qw * z + qx * y - qy * x;
            let iw = - qx * x - qy * y - qz * z;
    
            // calculate result * inverse quat
    
            this.x = ix * qw + iw * - qx + iy * - qz - iz * - qy;
            this.y = iy * qw + iw * - qy + iz * - qx - ix * - qz;
            this.z = iz * qw + iw * - qz + ix * - qy - iy * - qx;
    
            return this;
        }
    
        /**
         * @name this.project
         * @memberof Vector3
         *
         * @function
         * @param camera
        */
        project(camera) {
            let matrix = this.M1 || new Matrix4();
            this.M1 = matrix;
    
            matrix.multiplyMatrices( camera.projectionMatrix, matrix.getInverse( camera.matrixWorld ) );
            return this.applyMatrix4( matrix );
        }
    
        /**
         * @name this.unproject
         * @memberof Vector3
         *
         * @function
         * @param camera
        */
        unproject(camera) {
            let matrix = this.M1 || new Matrix4();
            this.M1 = matrix;
    
            matrix.multiplyMatrices( camera.matrixWorld, matrix.getInverse( camera.projectionMatrix ) );
            return this.applyMatrix4( matrix );
        }
    
        /**
         * @name this.transformDirection
         * @memberof Vector3
         *
         * @function
         * @param m
        */
        transformDirection(m) {
            let x = this.x, y = this.y, z = this.z;
            let e = m.elements;
    
            this.x = e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z;
            this.y = e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z;
            this.z = e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z;
    
            return this.normalize();
        }
    
        /**
         * @name divide
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} v
         * @return {Vector3}
         */
        divide(v) {
            this.x /= v.x;
            this.y /= v.y;
            this.z /= v.z;
    
            return this;
        }
    
        /**
         * @name divideScalar
         * @memberof Vector3
         *
         * @function
         * @param {Number} s
         * @return {Vector3}
         */
        divideScalar(scalar) {
            return this.multiplyScalar( 1 / scalar );
        }
    
        /**
         * @name this.min
         * @memberof Vector3
         *
         * @function
         * @param v
        */
        min(v) {
            this.x = Math.min( this.x, v.x );
            this.y = Math.min( this.y, v.y );
            this.z = Math.min( this.z, v.z );
    
            return this;
        }
    
        /**
         * @name this.max
         * @memberof Vector3
         *
         * @function
         * @param v
        */
        max(v) {
            this.x = Math.max( this.x, v.x );
            this.y = Math.max( this.y, v.y );
            this.z = Math.max( this.z, v.z );
    
            return this;
        }
    
        /**
         * @name this.clamp
         * @memberof Vector3
         *
         * @function
         * @param min
         * @param max
        */
        clamp(min, max) {
            this.x = Math.max( min.x, Math.min( max.x, this.x ) );
            this.y = Math.max( min.y, Math.min( max.y, this.y ) );
            this.z = Math.max( min.z, Math.min( max.z, this.z ) );
    
            return this;
        }
    
        /**
         * @name this.clampScalar
         * @memberof Vector3
         *
         * @function
         * @param minVal
         * @param maxVal
        */
        clampScalar(minVal, maxVal) {
            let min = new Vector3();
            let max = new Vector3();
    
            min.set( minVal, minVal, minVal );
            max.set( maxVal, maxVal, maxVal );
    
            return this.clamp( min, max );
        }
    
        /**
         * @name this.clampLength
         * @memberof Vector3
         *
         * @function
         * @param min
         * @param max
        */
        clampLength(min, max) {
            let length = this.length();
            return this.divideScalar( length || 1 ).multiplyScalar( Math.max( min, Math.min( max, length ) ) );
        }
    
        /**
         * @name this.floor
         * @memberof Vector3
         *
         * @function
        */
        floor() {
            this.x = Math.floor( this.x );
            this.y = Math.floor( this.y );
            this.z = Math.floor( this.z );
    
            return this;
        }
    
        /**
         * @name this.ceil
         * @memberof Vector3
         *
         * @function
        */
        ceil() {
            this.x = Math.ceil( this.x );
            this.y = Math.ceil( this.y );
            this.z = Math.ceil( this.z );
    
            return this;
        }
    
        /**
         * @name this.round
         * @memberof Vector3
         *
         * @function
        */
        round() {
            this.x = Math.round( this.x );
            this.y = Math.round( this.y );
            this.z = Math.round( this.z );
    
            return this;
        }
    
        /**
         * @name this.roundToZero
         * @memberof Vector3
         *
         * @function
        */
        roundToZero() {
            this.x = ( this.x < 0 ) ? Math.ceil( this.x ) : Math.floor( this.x );
            this.y = ( this.y < 0 ) ? Math.ceil( this.y ) : Math.floor( this.y );
            this.z = ( this.z < 0 ) ? Math.ceil( this.z ) : Math.floor( this.z );
    
            return this;
        }
    
        /**
         * @name this.negate
         * @memberof Vector3
         *
         * @function
        */
        negate() {
            this.x = - this.x;
            this.y = - this.y;
            this.z = - this.z;
    
            return this;
        }
    
        /**
         * @name dot
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} v
         * @return {Number}
         */
        dot(v) {
            return this.x * v.x + this.y * v.y + this.z * v.z;
        }
    
        /**
         * @name lengthSq
         * @memberof Vector3
         *
         * @function
         * @return {Number}
         */
        lengthSq() {
            return this.x * this.x + this.y * this.y + this.z * this.z;
        }
    
        /**
         * @name length
         * @memberof Vector3
         *
         * @function
         * @return {Number}
         */
        length() {
            return Math.sqrt( this.x * this.x + this.y * this.y + this.z * this.z );
        }
    
        /**
         * @name this.manhattanLength
         * @memberof Vector3
         *
         * @function
        */
        manhattanLength() {
            return Math.abs( this.x ) + Math.abs( this.y ) + Math.abs( this.z );
        }
    
        /**
         * @name normalize
         * @memberof Vector3
         *
         * @function
         * @return {Vector3}
         */
        normalize() {
            return this.divideScalar( this.length() || 1 );
        }
    
        /**
         * @name this.setLength
         * @memberof Vector3
         *
         * @function
         * @param length
        */
        setLength(length) {
            return this.normalize().multiplyScalar( length );
        }
    
        /**
         * @name length
         * @memberof Vector3
         *
         * @function
         * @return {Number}
         */
        lerp(v, alpha, hz) {
            this.x = Math.lerp(v.x, this.x, alpha, hz);
            this.y = Math.lerp(v.y, this.y, alpha, hz);
            this.z = Math.lerp(v.z, this.z, alpha, hz);
    
            return this;
        }
    
        /**
         * @name this.lerpVectors
         * @memberof Vector3
         *
         * @function
         * @param v1
         * @param v2
         * @param alpha
        */
        lerpVectors(v1, v2, alpha) {
            return this.subVectors( v2, v1 ).multiplyScalar( alpha ).add( v1 );
        }
    
        /**
         * @name cross
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} v
         * @return {Vector3}
         */
        cross(v) {
            return this.crossVectors( this, v );
        }
    
        /**
         * @name crossVectors
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} a
         * @param {Vector3} b
         * @return {Vector3}
         */
        crossVectors(a, b) {
            let ax = a.x, ay = a.y, az = a.z;
            let bx = b.x, by = b.y, bz = b.z;
    
            this.x = ay * bz - az * by;
            this.y = az * bx - ax * bz;
            this.z = ax * by - ay * bx;
    
            return this;
        }
    
        /**
         * @name this.projectOnVector
         * @memberof Vector3
         *
         * @function
         * @param vector
        */
        projectOnVector(vector) {
            let scalar = vector.dot( this ) / vector.lengthSq();
            return this.copy( vector ).multiplyScalar( scalar );
        }
    
        /**
         * @name this.projectOnPlane
         * @memberof Vector3
         *
         * @function
         * @param planeNormal
        */
        projectOnPlane(planeNormal) {
            let v1 = this.V1 || new Vector3();
            this.V1 = v1;
    
            v1.copy( this ).projectOnVector( planeNormal );
            return this.sub( v1 );
        }
    
        /**
         * @name this.reflect
         * @memberof Vector3
         *
         * @function
         * @param normal
        */
        reflect(normal) {
            let v1 = this.V1 || new Vector3();
            this.V1 = v1;
    
            return this.sub( v1.copy( normal ).multiplyScalar( 2 * this.dot( normal ) ) );
        }
    
        /**
         * @name angleTo
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} v
         * @return {Number}
         */
        angleTo(v) {
            let theta = this.dot( v ) / ( Math.sqrt( this.lengthSq() * v.lengthSq() ) );
            return Math.acos( Math.clamp( theta, - 1, 1 ) );
        }
    
        /**
         * @name distanceTo
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} v
         * @return {Number}
         */
        distanceTo(v) {
            return Math.sqrt( this.distanceToSquared( v ) );
        }
    
        /**
         * @name distanceToSquared
         * @memberof Vector3
         *
         * @function
         * @param {Vector3} v
         * @return {Number}
         */
        distanceToSquared(v) {
            let dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
            return dx * dx + dy * dy + dz * dz;
        }
    
        /**
         * @name this.manhattanDistanceTo
         * @memberof Vector3
         *
         * @function
         * @param v
        */
        manhattanDistanceTo(v) {
            return Math.abs( this.x - v.x ) + Math.abs( this.y - v.y ) + Math.abs( this.z - v.z );
        }
    
        /**
         * @name this.setFromCylindrical
         * @memberof Vector3
         *
         * @function
         * @param c
        */
        setFromCylindrical(c) {
            this.x = c.radius * Math.sin( c.theta );
            this.y = c.y;
            this.z = c.radius * Math.cos( c.theta );
    
            return this;
        }
    
        /**
         * @name setFromMatrixPosition
         * @memberof Vector3
         *
         * @function
         * @param {Matrix4} m
         * @return {Vector3}
         */
        setFromMatrixPosition(m) {
            let e = m.elements;
    
            this.x = e[ 12 ];
            this.y = e[ 13 ];
            this.z = e[ 14 ];
    
            return this;
        }
    
        /**
         * @name setFromMatrixScale
         * @memberof Vector3
         *
         * @function
         * @param {Matrix4} m
         * @return {Vector3}
         */
        setFromMatrixScale(m) {
            let sx = this.setFromMatrixColumn( m, 0 ).length();
            let sy = this.setFromMatrixColumn( m, 1 ).length();
            let sz = this.setFromMatrixColumn( m, 2 ).length();
    
            this.x = sx;
            this.y = sy;
            this.z = sz;
    
            return this;
        }
    
        /**
         * @name this.setFromMatrixColumn
         * @memberof Vector3
         *
         * @function
         * @param m
         * @param index
        */
        setFromMatrixColumn(m, index) {
            return this.fromArray( m.elements, index * 4 );
        }
    
        /**
         * @name this.setAngleRadius
         * @memberof Vector3
         *
         * @function
         * @param a
         * @param r
         * @param dir
        */
        setAngleRadius(a, r, dir = 'xy') {
            this[dir[0]] = Math.cos(a) * r;
            this[dir[1]] = Math.sin(a) * r;
            return this;
        }
    
        /**
         * @name this.addAngleRadius
         * @memberof Vector3
         *
         * @function
         * @param a
         * @param r
         * @param dir
        */
        addAngleRadius(a, r, dir = 'xy') {
            this[dir[0]] += Math.cos(a) * r;
            this[dir[1]] += Math.sin(a) * r;
            return this;
        }
    
        /**
         * @name this.equals
         * @memberof Vector3
         *
         * @function
         * @param v
        */
        equals(v) {
            return ( ( v.x === this.x ) && ( v.y === this.y ) && ( v.z === this.z ) );
        }
    
        /**
         * @name this.fromArray
         * @memberof Vector3
         *
         * @function
         * @param array
         * @param offset
        */
        fromArray(array, offset) {
            if ( offset === undefined ) offset = 0;
    
            this.x = array[ offset ];
            this.y = array[ offset + 1 ];
            this.z = array[ offset + 2 ];
    
            return this;
        }
    
        /**
         * @name this.setFromSpherical
         * @memberof Vector3
         *
         * @function
         * @param s
        */
        setFromSpherical(s) {
            this.setFromSphericalCoords(s.radius, s.phi, s.theta);
        }
    
        /**
         * @name this.setFromSphericalCoords
         * @memberof Vector3
         *
         * @function
         * @param radius
         * @param phi
         * @param theta
        */
        setFromSphericalCoords(radius, phi, theta) {
            let sinPhiRadius = Math.sin( phi ) * radius;
    
            this.x = sinPhiRadius * Math.sin( theta );
            this.y = Math.cos( phi ) * radius;
            this.z = sinPhiRadius * Math.cos( theta );
    
            return this;
        }
    
        /**
         * @name this.toArray
         * @memberof Vector3
         *
         * @function
         * @param array
         * @param offset
        */
        toArray(array, offset) {
            if ( array === undefined ) array = [];
            if ( offset === undefined ) offset = 0;
    
            array[ offset ] = this.x;
            array[ offset + 1 ] = this.y;
            array[ offset + 2 ] = this.z;
    
            return array;
        }
    
        /**
         * @name this.fromBufferAttribute
         * @memberof Vector3
         *
         * @function
         * @param attribute
         * @param index
        */
        fromBufferAttribute(attribute, index) {
            this.x = attribute.array[index * 3 + 0];
            this.y = attribute.array[index * 3 + 1];
            this.z = attribute.array[index * 3 + 2];
    
            return this;
        }
    }