import * as THREE from 'three'

export async function buildGlobe() {
  const texture = await new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      '/earth.png',
      resolve,
      undefined,
      reject
    )
  })

  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 16

  const geometry = new THREE.SphereGeometry(1, 128, 128)
  const material = new THREE.MeshPhongMaterial({
    map: texture,
    shininess: 10,
    specular: new THREE.Color(0x112244),
    bumpScale: 0.002
  })

  return new THREE.Mesh(geometry, material)
}
