#!/usr/bin/env node
// console.log(process.cwd())
// console.log(process.argv)

const child_process = require('child_process')
const fs = require('fs')
const path = require('path')

const readdir = require('fs-readdir-recursive')


const args = process.argv.slice(2)
const doubleDashIndex = args.indexOf('--')

let files = []
let babel = []
if (doubleDashIndex === -1) {
    files = args
} else {
    files = args.slice(0, doubleDashIndex)
    babel = args.slice(doubleDashIndex + 1)
}

const babelCommand = babel.length ? babel.join(' ') : 'babel'
console.log(files)
console.log(babelCommand)
process.exit()

let builtFileManifest
try {
    builtFileManifest = JSON.parse(fs.readFileSync('babel-incremental-manifest.json', {encoding:'utf-8'}))
} catch (e) {
    builtFileManifest = {}
}
console.log(builtFileManifest)

const sourceFileManifest = files.reduce((manifest, filename) => {
    if (!fs.existsSync(filename)) {
        return manifest
    }

    const currentManifest = {}
    if (fs.statSync(filename).isDirectory(filename)) {
        readdir(filename).forEach(innerFilename => {
            const fullpath = path.join(filename, innerFilename)
            if (path.extname(fullpath) === '.js') {
                currentManifest[fullpath] = fs.statSync(fullpath).ctimeMs
            }
        })
    } else {
        if (path.extname(filename) === '.js') {
            currentManifest[filename] = fs.statSync(filename).ctimeMs
        }
    }

    return {
        ...manifest,
        ...currentManifest,
    }
}, {})
console.log(sourceFileManifest)


const filesToBabelize = Object.keys(sourceFileManifest).filter(filename => {
    if (builtFileManifest[filename] === sourceFileManifest[filename]) {
        console.log(filename, 'has not been modified, not re-compiling')
        return false
    } else {
        console.log(filename, 'has been modified, re-compiling')
        return true
    }
})
console.log(filesToBabelize)

const command = `${babel} ${filesToBabelize.join(' ')}`
console.log(command)

if (filesToBabelize.length) {
    child_process.execSync(command, {stdio: 'inherit'})
} else {
    console.log('all files are up to date, nothing to be done')
}

fs.writeFileSync('babel-incremental-manifest.json', JSON.stringify(sourceFileManifest), {encoding: 'utf-8'})