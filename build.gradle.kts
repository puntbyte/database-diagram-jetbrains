plugins {
  id("java")
  id("org.jetbrains.kotlin.jvm") version "2.1.20"
  id("org.jetbrains.intellij.platform") version "2.10.2"
  id("com.github.node-gradle.node") version "7.1.0"
}

group = "com.puntbyte"
version = "1.0-SNAPSHOT"

repositories {
  mavenCentral()
  intellijPlatform {
    defaultRepositories()
  }
}

val localIdePath = "C:\\Program Files\\JetBrains\\IntelliJ IDEA 2025.3.3"
val localDbmlPluginPath =
  "E:\\Projects\\Gradle\\database-markup-language-jetbrains\\build\\distributions\\" +
      "database-markup-language-jetbrains-1.0-SNAPSHOT.zip"

// Read more: https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html
dependencies {
  intellijPlatform {
    //intellijIdea("2025.2.4")

    // Use your local IDE installation instead of downloading one
    local(localIdePath)

    // 2. Your local DBML Plugin ZIP
    localPlugin(file(localDbmlPluginPath))

    // keep the testFramework declaration here if you need it
    testFramework(org.jetbrains.intellij.platform.gradle.TestFrameworkType.Platform)


    // Add plugin dependencies for compilation here, example:
    // bundledPlugin("com.intellij.java")
  }

  implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.15.2")
}

intellijPlatform {
  pluginConfiguration {
    ideaVersion {
      sinceBuild = "252.25557"
    }

    changeNotes = """
            Initial version
        """.trimIndent()
  }
}

node {
  version.set("22.22.0")
  download.set(true)
  workDir.set(file("${project.projectDir}/.gradle/nodejs"))
  nodeProjectDir.set(file("web")) // Point to our webview folder
}

tasks {

  // Set the JVM compatibility versions
  withType<JavaCompile> {
    sourceCompatibility = "21"
    targetCompatibility = "21"
  }

  val buildWebview by registering(com.github.gradle.node.npm.task.NpmTask::class) {
    dependsOn(npmInstall) // Ensure dependencies are installed
    args.set(listOf("run", "build"))

    // Caching: Only rebuild if these files change
    inputs.dir(file("web/src"))
    inputs.file(file("web/package.json"))
    inputs.file(file("web/vite.config.ts"))
    inputs.file(file("web/index.html"))
    outputs.dir(file("src/main/resources/web"))
  }

  processResources {
    dependsOn(buildWebview)
  }
}

kotlin {
  compilerOptions {
    jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
  }
}
