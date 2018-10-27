#!/usr/bin/env node

const child_process = require('child_process')
const fs = require('fs')
const path = require('path')

const findCacheDir = require('find-cache-dir')
const readdir = require('fs-readdir-recursive')

let MANIFEST_PATH
function getManifestPath() {
    if (MANIFEST_PATH) {
        return MANIFEST_PATH
    }
    const manifestPathFinder = findCacheDir({
        name: 'babel-incremental-cli',
        create: true,
        thunk: true,
    })
    return (MANIFEST_PATH = manifestPathFinder('lastBuildManifest.json'))
}

function getLastBuildManifest() {
    const manifestPath = getManifestPath()
    try {
        return JSON.parse(
            fs.readFileSync(manifestPath, {
                encoding: 'utf-8',
            }),
        )
    } catch (e) {
        return {}
    }
}

const COMPILABLE_EXTENSIONS = Object.freeze([
    '.js',
    '.jsx',
    '.es6',
    '.es',
    '.mjs',
])

const isCompilable = filename =>
    COMPILABLE_EXTENSIONS.includes(path.extname(filename))

const getModificationTime = filename => fs.statSync(filename).ctimeMs

function getCurrentBuildManifest(files) {
    return files.reduce((manifest, filename) => {
        if (!fs.existsSync(filename)) {
            return manifest
        }

        if (fs.statSync(filename).isDirectory(filename)) {
            readdir(filename)
                .filter(isCompilable)
                .forEach(innerFilename => {
                    const fullpath = path.join(filename, innerFilename)
                    manifest[fullpath] = getModificationTime(fullpath)
                })
        } else if (isCompilable(filename)) {
            manifest[filename] = getModificationTime(filename)
        }

        return manifest
    }, {})
}

function splitFilesAndBabelCommand() {
    const args = process.argv.slice(2)
    const doubleDashIndex = args.indexOf('--')

    if (doubleDashIndex === -1) {
        return {
            inputFiles: args,
            babelCommand: 'babel',
        }
    } else {
        return {
            inputFiles: args.slice(0, doubleDashIndex),
            babelCommand: args.slice(doubleDashIndex + 1).join(' '),
        }
    }
}

function writeCurrentBuildManifest(currentBuildManifest) {
    const manifestPath = getManifestPath()
    fs.writeFileSync(manifestPath, JSON.stringify(currentBuildManifest), {
        encoding: 'utf-8',
    })
}

function main() {
    const { inputFiles, babelCommand } = splitFilesAndBabelCommand()

    const lastBuildManifest = getLastBuildManifest()
    const currentBuildManifest = getCurrentBuildManifest(inputFiles)

    const filesToBabelize = Object.keys(currentBuildManifest).filter(
        filename =>
            lastBuildManifest[filename] !== currentBuildManifest[filename],
    )

    if (filesToBabelize.length) {
        const command = `${babelCommand} ${filesToBabelize.join(' ')}`
        child_process.execSync(command, { stdio: 'inherit' })
    } else {
        console.log(
            `${path.basename(
                process.cwd(),
            )}: All files are up to date, nothing to be done`,
        )
    }

    writeCurrentBuildManifest(currentBuildManifest)
}

main()
