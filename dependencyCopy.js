var yes = !0, no = !1

var dryRun = no

var log = function() {
  if(0) process.stderr.write([].join.apply(arguments, [", "]) + "\n") 
}
var fsLog = function() {
  if(0) process.stderr.write("\u001B[33m" + [].join.apply(arguments, [", "]) + "\u001B[0m" + "\n")
}
var print = function(s) {
  process.stdout.write(s) 
}
var assert = function(expr) {
  if(!expr) {
    throw new Error()
  }
}
var Fs = require("fs")
var fStat = function(path) {
  try {
    return Fs.statSync(path)
  }
  catch(err) {
    return null
  }
}
var fReadText = function(path) {
  try {
    return Fs.readFileSync(path, { 
      encoding: "utf8"
    })
  }
  catch(err) {
    return null
  }
}

var mkDir = function(dirPath) {
  try {
    fsLog("mkDir", dirPath)
    if(dryRun == no) Fs.mkdirSync(dirPath.replace(/\\(\w):\\/, "\\$1\\").slice(0, -1))
  }
  catch(err) {
    
  }
}

var copyFile = function(inputFilePath, outputFilePath) {
  fsLog("copyFile", inputFilePath, outputFilePath)
  if(dryRun == no) Fs.writeFileSync(outputFilePath.replace(/\\(\w):\\/, "\\$1\\"), Fs.readFileSync(inputFilePath))
}

var toUnixEol = function(s) {
  var p = s.indexOf('\n')
  
  //# mac format
  if(p < 0) { 
    return s.replace(/\r/g, '\n')
  }
  //# win format
  else if(s.charAt(p - 1) == '\r') {
    return s.replace(/\r/g, '')
  } 
  //# unix format
  else {
    return s  
  }
}

var Path = require("path")
var nativePathToUnixPath = function(path) {
  //# win style
  if(Path.sep == "\\") {
    //# drive
    if(path.match(/^\w:/)) {
      path = "/" + path 
    }
    return path.replace(/\\/g, "/")
  }
  //# unix style
  else {
    return path
  }
}

var unixPathToNativePath = function(path) {
  //# win style
  if(Path.sep == "\\") {
    //# drive
    if(path.match(/^\/\w:/)) {
      path = path.slice(1)
    }
    return path.replace(/\//g, "\\")
  }
  //# unix style
  else {
    return path
  }
}


var IncorrectUsageError = function(msg) {
  if(!(this instanceof IncorrectUsageError)) {
    return new IncorrectUsageError(msg)
  }
  this.msg = msg
}
var FsError = function(msg) {
  if(!(this instanceof FsError)) {
    return new FsError(msg)
  }
  this.msg = msg
}

var isRelatedPath = function(path) {
  return path[0] != "/"
}

var dirPath = function(path) {
  var i = path.lastIndexOf("/")
  if(i == -1) {
    i = 0
  }
  return path.slice(0, i + 1)
}

var normalizePath = function(path) {
  return (path
    .replace(/\\/g, "/")
    .replace(/\/\.(?=\/)/g, "")
  )
}

var dumpTree = function(tree) {
  return JSON.stringify(tree, function(k, v) {
    if(k == "parent") {
      return
    }
    else {
      return v
    }
  }, "  ")
}

var findTreeSplitPoint = function(roots) {
  var path = ""
  var children = roots
  for(;;) {
    if(Object.keys(children).length == 1) {
      children = children[Object.keys(children)[0]].children
    }
    else if(Object.keys(children).length == 0) {
      break
    }
    else {
      break
    }
  }
  return children
}

var findTreeSplitPoint = function(tree) {
  var path = ""
  for(;;) {
    var children = tree.children
    if(Object.keys(children).length == 1) {
      tree = children[Object.keys(children)[0]]
    }
    else if(Object.keys(children).length == 0) {
      break
    }
    else {
      break
    }
  }
  return tree
}

var getPathToTree = function(tree) {
  var path = ""
  for(;;) {
    if(tree == null) {
      break
    }
    var parentTree = tree.parent
    if(parentTree == null) {
      break
    }
    var treeKey = Object.keys(parentTree.children).reduce(function(r, vistedTreeKey) {
      if(r) {
        return r
      }
      else if(parentTree.children[vistedTreeKey] == tree) {
        return vistedTreeKey
      }
      else {
        return null
      }
    }, null)
    
    path = "".concat("/", treeKey, path) 
    tree = parentTree
  }
  return path
}

var patchTree = function(tree, path) {
  var parts = (path
    //# cut first slash
    .slice(1)
    .split("/")
  )
  for(var i = 0; i < parts.length; i += 1) {
    var part = parts[i]
    if(part == ".") {
      
    }
    else if(part == "..") {
      assert(tree.parent != null)
      tree = tree.parent
    }
    else {
      tree = tree.children[part] || (tree.children[part] = {
        parent: tree, 
        children: {  }
      })
    }
  }
}

var collectTree = function(tree, path, traceInd) {
  traceInd = traceInd || ""
  log(traceInd + "in", path)
  if(fStat(unixPathToNativePath(path)) == null) {
    throw FsError("".concat(path, " does not exist"))
  }
  else if(!fStat(unixPathToNativePath(path)).isFile()) {
    throw FsError("".concat(path, " is not a file"))
  }
  else {
    patchTree(tree, path)
    var text = fReadText(unixPathToNativePath(path))
    if(text == null) {
      throw FsError("".concat("Can not read from ", path))
    }
    else {
      var normalizedText = "\n" + toUnixEol(text) + "\n"
      normalizedText.replace(/\n[ \t]*#include[ \t]+/g, function(all, pos) {
        var dependencyPathMatch = normalizedText.slice(pos + all.length).match(/^([`\"])(.*?)\1/)
        if(dependencyPathMatch) {
          var dependencyPath = dependencyPathMatch[2]
          if(isRelatedPath(dependencyPath)) {
            dependencyPath = dirPath(path) + dependencyPath
          }
          
          patchTree(tree, dependencyPath)
          collectTree(tree, dependencyPath, traceInd + "  ")
        }
      })
    }
  }
}

var copyTree = function(tree, outputDirPath) {
  log(outputDirPath)
  mkDir(outputDirPath)
  Object.keys(tree.children).forEach(function(k) {
    var nativePath = unixPathToNativePath(getPathToTree(tree.children[k]))
    if(fStat(nativePath).isDirectory()) {
      //? mkDir(nativePath + Path.sep)
      copyTree(tree.children[k], outputDirPath + k + Path.sep)
    }
    else {
      copyFile(nativePath, outputDirPath + k)
    }
  })
}

var main = function(args) {
  if(args[1] == null) {
    throw IncorrectUsageError("Missed input file path")
  }
  else {
    var inputFilePath = args[1]
    if(fStat(inputFilePath) == null) {
      throw FsError("Input file does not exist")
    }
    else if(!fStat(inputFilePath).isFile()) {
      throw FsError("Input file is not a file")
    }
    else {
      if(args[2] == null) {
        throw IncorrectUsageError("Missed ouput dir path")
      }
      else {
        var outputDirPath = args[2]
        if(outputDirPath.substr(-1, 1) != Path.sep) {
          throw IncorrectUsageError("Output dir path should ends by (back)slash")
        }
        else if(fStat(outputDirPath) == null) {
          throw FsError("Output dir does not exist")
        }
        else if(!fStat(outputDirPath).isDirectory()) {
          throw FsError("Output dir is not a dir")
        }
        else {
          //# actual job
          try {
            var tree = {
              parent: null, 
              children: {  }
            }
            
            inputFilePath = nativePathToUnixPath(inputFilePath)
            if(isRelatedPath(inputFilePath)) {
              inputFilePath = nativePathToUnixPath(process.cwd()) + "/" + inputFilePath
            }
            collectTree(tree, inputFilePath)
            log(dumpTree(tree))
            var treeSplitPoint = findTreeSplitPoint(tree)
            print(unixPathToNativePath(getPathToTree(treeSplitPoint)) + Path.sep)
            copyTree(treeSplitPoint, outputDirPath)
          }
          catch(err) {
            if(err instanceof FsError) {
              throw err
            }
            else {
              throw err
            }
          }
        }
      }
    }
  }
}

var exitCode = 0
try {
  main([].slice.apply(process.argv, [1]))
}
catch(err) {
  if(err instanceof IncorrectUsageError) {
    print(err.msg)
    exitCode = 1
  }
  else if(err instanceof FsError) {
    print(err.msg)
    exitCode = 2
  }
  else {
    throw err
  }
}
process.exit(exitCode)
