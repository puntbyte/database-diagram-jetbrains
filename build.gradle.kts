// database-diagram-jetbrains/build.gradle.kts

plugins {
  id("java")
  id("org.jetbrains.kotlin.jvm") version "2.1.20"
  id("org.jetbrains.intellij.platform") version "2.10.2"
  id("com.github.node-gradle.node") version "7.1.0"
}

group = "com.puntbyte"
version = "1.0-SNAPSHOT"

// ---------------------------------------------------------------------------
// Web project location — resolved in priority order:
//   1. WEB_PROJECT_DIR environment variable  (ideal for CI)
//   2. webProjectDir property in gradle.properties  (ideal for local dev)
//   3. Sibling directory fallback "../database-diagram-web"
// ---------------------------------------------------------------------------
val webProjectDir: File = run {
  val fromEnv = System.getenv("WEB_PROJECT_DIR")
  val fromProp = findProperty("webProjectDir") as String?
  val raw = fromEnv ?: fromProp ?: "../database-diagram-web"
  file(raw).canonicalFile   // resolve relative paths against project root
}

// Fail fast with a clear message rather than a cryptic npm exit code 2.
require(webProjectDir.exists()) {
  """
    Web project not found at: $webProjectDir
 
    Fix one of:
      a) Set webProjectDir=<path> in gradle.properties  (gitignored, local only)
      b) Export WEB_PROJECT_DIR=<path> in your shell / CI environment
      c) Place the web project next to this project as  ../database-diagram-web
    """.trimIndent()
}

val webDistDir: File = webProjectDir.resolve("dist")
val webResourcesDir: File = file("src/main/resources/web")

// ---------------------------------------------------------------------------
// Node / npm configuration
// ---------------------------------------------------------------------------
node {
  version.set("22.22.0")
  download.set(true)
  // Store the downloaded Node runtime inside the Kotlin project so it is
  // not re-downloaded when the web project directory changes.
  workDir.set(file("${project.projectDir}/.gradle/nodejs"))
  // Run all npm commands inside the standalone web project directory.
  nodeProjectDir.set(webProjectDir)
}


// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
tasks {

  withType<JavaCompile> {
    sourceCompatibility = "21"
    targetCompatibility = "21"
  }

  kotlin {
    compilerOptions {
      jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
    }
  }

  // Declare inputs on the auto-created npmInstall task.
  named("npmInstall") {
    inputs.file(webProjectDir.resolve("package.json"))
    inputs.file(webProjectDir.resolve("package-lock.json").takeIf { it.exists() }
      ?: webProjectDir.resolve("package.json"))
  }

  // Build the web bundle.  Uses `npm run build` which is just `vite build`
  // so TypeScript compilation errors will not block the Gradle build.
  // Run `npm run typecheck` separately in the web project to check types.
  val buildWebview by registering(com.github.gradle.node.npm.task.NpmTask::class) {
    dependsOn("npmInstall")
    args.set(listOf("run", "build"))

    // Up-to-date checks: skip if nothing changed.
    inputs.dir(webProjectDir.resolve("src"))
    inputs.file(webProjectDir.resolve("package.json"))
    inputs.file(webProjectDir.resolve("vite.config.ts"))
    inputs.file(webProjectDir.resolve("index.html"))
    outputs.dir(webDistDir)
  }

  // Copy the built bundle into the plugin's resources directory.
  // Run this task alone with:  ./gradlew copyWebDist
  val copyWebDist by registering(Copy::class) {
    dependsOn(buildWebview)

    from(webDistDir)
    into(webResourcesDir)

    doFirst {
      // Clear stale files so deleted web assets don't linger in the JAR.
      webResourcesDir.deleteRecursively()
    }
  }

  processResources {
    dependsOn(copyWebDist)
  }
}

// ---------------------------------------------------------------------------
// Repositories & dependencies (unchanged from original)
// ---------------------------------------------------------------------------

repositories {
  mavenCentral()
  intellijPlatform { defaultRepositories() }
}

val localIdePath = "C:\\Program Files\\JetBrains\\IntelliJ IDEA 2025.3.3"

dependencies {
  intellijPlatform {
    //intellijIdea("2025.2.4")

    // Use your local IDE installation instead of downloading one
    local(localIdePath)

    // keep the testFramework declaration here if you need it
    testFramework(org.jetbrains.intellij.platform.gradle.TestFrameworkType.Platform)


    // Add JetBrains Database and YAML plugins
    // 1. Add YAML plugin for parsing and updating the .erd.yaml layout file
    bundledPlugin("org.jetbrains.plugins.yaml")

    // 2. Add Database plugin for parsing SQL files (PSI)
    bundledPlugin("com.intellij.database") // SQL PSI comes with this
  }

  implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.15.2")
}

intellijPlatform {
  pluginConfiguration {
    ideaVersion { sinceBuild = "252.25557" }
    changeNotes = "Initial version".trimIndent()
  }
}

