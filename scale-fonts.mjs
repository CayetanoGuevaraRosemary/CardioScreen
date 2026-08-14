import fs from 'fs'
const archivo = 'src/App.tsx'
const factor = 1.15 
let txt = fs.readFileSync(archivo, 'utf8')
txt = txt.replace(/fontSize:\s*(\d+(\.\d+)?)/g, (_, n) => `fontSize: ${Math.round(parseFloat(n) * factor * 10) / 10}`)
fs.writeFileSync(archivo, txt)
console.log('Listo — tamaños de letra escalados x' + factor)