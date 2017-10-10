"use strict";

module.exports = function (grunt) {
    var pkg = grunt.file.readJSON("package.json");
    grunt.initConfig({

        watch: {
            updateWidgetFiles: {
                files: [ "./dist/tmp/src/**/*" ],
                tasks: [ "compress:dist", "copy:distDeployment", "copy:mpk" ],
                options: {
                    debounceDelay: 250,
                    livereload: true
                }
            },
            sourceFiles: {
                files: [ "./src/**/*" ],
                tasks: [ "copy:source" ]
            }
        },

        compress: {
            dist: {
                options: {
                    archive: "./dist/" + pkg.version + "/" + pkg.widgetName + ".mpk",
                    mode: "zip"
                },
                files: [ {
                    expand: true,
                    date: new Date(),
                    store: false,
                    cwd: "./dist/tmp/src",
                    src: [ "**/*" ]
                } ]
            }
        },

        copy: {
            distDeployment: {
                files: [ {
                    dest: "./dist/MxTestProject/deployment/web/widgets",
                    cwd: "./dist/tmp/src/",
                    src: [ "**/*" ],
                    expand: true
                } ]
            },
            mpk: {
                files: [ {
                    dest: "./dist/MxTestProject/widgets",
                    cwd: "./dist/" + pkg.version + "/",
                    src: [ pkg.widgetName + ".mpk" ],
                    expand: true
                } ]
            },
            source: {
                files: [ {
                    dest: "./dist/tmp/src",
                    cwd: "./src/",
                    src: [ "**/*", "!**/*.ts", "!**/*.css" ],
                    expand: true
                } ]
            }
        },

        clean: {
            build: [
                "./dist/" + pkg.version + "/" + pkg.widgetName + "/*",
                "./dist/tmp/**/*",
                "./dist/MxTestProject/deployment/web/widgets/" + pkg.widgetName + "/*",
                "./dist/MxTestProject/widgets/" + pkg.widgetName + ".mpk"
            ]
        }
    });

    grunt.loadNpmTasks("grunt-contrib-compress");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.registerTask("default", ["clean build", "watch"]);
    
    grunt.registerTask(
            "clean build",
            "Compiles all the assets and copies the files to the build directory.", ["clean:build", "copy:source", "compress:dist", "copy:mpk"]
            );
    grunt.registerTask("build", ["clean build"]);
};
