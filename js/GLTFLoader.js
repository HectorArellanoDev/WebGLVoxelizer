
const TYPE_ARRAY = {
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
    'image/jpeg': Uint8Array,
    'image/png': Uint8Array,
};

const TYPE_SIZE = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16,
};

const ATTRIBUTES = {
    POSITION: 'position',
    NORMAL: 'normal',
    TANGENT: 'tangent',
    TEXCOORD_0: 'uv',
    TEXCOORD_1: 'uv2',
    COLOR_0: 'color',
    WEIGHTS_0: 'skinWeight',
    JOINTS_0: 'skinIndex',
};

const TRANSFORMS = {
    translation: 'position',
    rotation: 'quaternion',
    scale: 'scale',
};

let _path, _id;

class GLTFLoader {

    async parse(path) {
        
        let name = path.split("/");
        name = name[name.length - 1];
        console.log(name);
        name = name.split(".")[0];

        _id = name;
        _path = path;

        let nodes = null;
        let json, binary;

        //For .glb files
        if(String(path).indexOf(".glb") > 0 ) {
            let data = await this.loadBinary(_path);
            json = data.json;
            binary = data.binary;
        }

        //For .gltf + binary files.
        if(String(path).indexOf(".gltf") > 0) {

            json = await fetch(path).then((res) => res.json());
            
            binary = await Promise.all(
                json.buffers.map(buffer => {
                    const uri = this.resolveURI(buffer.uri);
                    return fetch(uri).then((res) => res.arrayBuffer());
                })
            );

            binary = binary[0];

        }


        const desc = json; 
        const buffers = binary;

        const bufferViews = this.parseBufferViews(desc, buffers);

        const materials = await this.parseMaterials(desc, null);

        const meshes = this.parseMeshes(desc, bufferViews, materials);

        return meshes;

    }

    loadBinary = async function(path) {

        let json, binary;
        let result = Promise.create();

        fetch(path).then(res => {

            if (!res.ok) throw new Error();
            return res.arrayBuffer();

        }).then(async (gltfBuffer) => {

            const BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
            const BINARY_EXTENSION_HEADER_LENGTH = 12;
            const BINARY_EXTENSION_CHUNK_TYPES = {
                JSON: 0x4E4F534A,
                BIN: 0x004E4942
            };

            const headerView = new DataView( gltfBuffer, 0, BINARY_EXTENSION_HEADER_LENGTH );
            const decoder = new TextDecoder();

            let header = {
                magic: decoder.decode(gltfBuffer.slice(0, 4)),
                version: headerView.getUint32( 4, true ),
                length: headerView.getUint32( 8, true )
            };

            if ( header.magic !== BINARY_EXTENSION_HEADER_MAGIC ) {

                throw new Error( 'GLTFLoader: Unsupported glTF-Binary header.' );

            } else if (header.version < 2.0 ) {

                throw new Error( 'GLTFLoader: Legacy binary file detected.' );

            }

            const chunkContentsLength = header.length - BINARY_EXTENSION_HEADER_LENGTH;
            const chunkView = new DataView( gltfBuffer, BINARY_EXTENSION_HEADER_LENGTH );
            let chunkIndex = 0;

            let _content = null;

            while ( chunkIndex < chunkContentsLength ) {

                const chunkLength = chunkView.getUint32( chunkIndex, true );
                chunkIndex += 4;
                const chunkType = chunkView.getUint32( chunkIndex, true );
                chunkIndex += 4;

                if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON ) {

                    const contentArray = new Uint8Array( gltfBuffer, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength );
                    _content = decoder.decode( contentArray );

                } else if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN ) {

                    const byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
                    binary = gltfBuffer.slice( byteOffset, byteOffset + chunkLength );

                }

                chunkIndex += chunkLength;

            }

            if ( _content === null ) {

                throw new Error( 'GLTFLoader: JSON content not found.' );

            }

            json = JSON.parse( _content );

            console.log(json);

            if ( json.asset === undefined || json.asset.version[ 0 ] < 2 ) {

                if ( onError ) onError( new Error( 'GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.' ) );
                return;

            }

            result.resolve();
        });

        await result;
        return {json, binary}
    }

    parseBufferViews = function(desc, buffers) {

        if (!desc.bufferViews) return null;

        // Clone to leave description pure
        const bufferViews = desc.bufferViews.map((o) => Object.assign({}, o));

        // Get componentType of each bufferView from the accessors
        desc.accessors.forEach(({ bufferView: i, componentType }) => {
            if (i < bufferViews.length) bufferViews[i].componentType = componentType;
        });

        // Push each bufferView to the GPU as a separate buffer
        bufferViews.forEach(
            (
                {
                    byteOffset = 0, // optional
                    byteLength, // required
                    componentType,
                },
                i
            ) => {
                bufferViews[i].data = buffers.slice(byteOffset, byteOffset + byteLength);
            }
        );

        return bufferViews;
    }

    resolveURI = function(uri) {

        let dir = _path.split("/");
        dir.pop();
        dir = dir.join("/");

        // Invalid URI
        if (typeof uri !== 'string' || uri === '') return '';

        // Host Relative URI
        if (/^https?:\/\//i.test(dir) && /^\//.test(uri)) {
            dir = dir.replace(/(^https?:\/\/[^\/]+).*/i, '$1');
        }

        // Absolute URI http://, https://, //
        if (/^(https?:)?\/\//i.test(uri)) return uri;

        // Data URI
        if (/^data:.*,.*$/i.test(uri)) return uri;

        // Blob URI
        if (/^blob:.*$/i.test(uri)) return uri;

        // Relative URI
        return dir + "/" + uri;
    }

    parseMaterials = function(desc) {
        if (!desc.materials) return null;
        return desc.materials.map(
            ({
                name,
                extensions,
                extras,
                pbrMetallicRoughness = {},
                normalTexture,
                occlusionTexture,
                emissiveTexture,
                emissiveFactor = [0, 0, 0],
                alphaMode = 'OPAQUE',
                alphaCutoff = 0.5,
                doubleSided = false,
            }) => {
                const {
                    baseColorFactor = [1, 1, 1, 1],
                    baseColorTexture,
                    metallicFactor = 1,
                    roughnessFactor = 1,
                    metallicRoughnessTexture,
                } = pbrMetallicRoughness;

                return {
                    name,
                    extensions,
                    extras,
                    baseColorFactor,
                    baseColorTexture,
                    metallicFactor,
                    roughnessFactor,
                    metallicRoughnessTexture,
                    normalTexture,
                    occlusionTexture,
                    emissiveTexture,
                    emissiveFactor,
                    alphaMode,
                    alphaCutoff,
                    doubleSided,
                };
            }
        );
    }

    parseMeshes = function( desc, bufferViews, materials) {
        if (!desc.meshes) return null;

        
        return desc.meshes.map(
            (
                {
                    name,
                    primitives
                },
                index1
            ) => {

                primitives = this.parsePrimitives(primitives, desc, bufferViews, materials).map(
                    ({geometry, materialDefinition}, index2) => {
                        return {geometry, materialDefinition};
                    }
                );

                return primitives;
            }
        );
    }

    parsePrimitives = function(primitives, desc, bufferViews, materials) {

        return primitives.map(
            ({
                attributes, // required
                indices,
                material: materialIndex,
            }) => {

                let materialDefinition = null;
                
                if (materialIndex !== undefined) {
                    materialDefinition = materials[materialIndex];
                }

                let geometry = {};

                // Add each attribute found in primitive
                for (let attr in attributes) {
                    let buffer = this.parseAccessor(attributes[attr], desc, bufferViews);

                    geometry[ATTRIBUTES[attr]] = {
                        array: buffer.data,
                        itemSize: buffer.size
                    }
                    
                }

                // Add index attribute if found
                if (indices !== undefined) {
                    let buffer = this.parseAccessor(indices, desc, bufferViews);
                    geometry.index = buffer.data;
                }
                
                return {geometry, materialDefinition};
            }
        );
    }

    parseAccessor = function(index, desc, bufferViews, _bufferViewIndex = null) {
        // TODO: init missing bufferView with 0s
        // TODO: support sparse

        let {
            bufferView: bufferViewIndex, // optional
            byteOffset = 0, // optional
            componentType, // required
            normalized = false, // optional
            count, // required
            type, // required
            min, // optional
            max // optional

        } = desc.accessors[index];

        if (_bufferViewIndex !== null) bufferViewIndex = _bufferViewIndex;

        const {
            data, // attached in parseBufferViews
            buffer, // replaced to be the actual GL buffer
            // byteOffset: bufferByteOffset = 0,
            byteStride = 0

        } = bufferViews[bufferViewIndex];

        const size = TYPE_SIZE[type];


        // Parse data from joined buffers
        const TypeArray = TYPE_ARRAY[componentType];
        const newData =  new TypeArray(data, byteOffset);

        // Return attribute data
        return {
            data: newData,
            size,
            type: componentType,
            normalized,
            buffer,
            stride: byteStride,
            offset: byteOffset,
            count,
            min,
            max
        };
    }

}

export {GLTFLoader}