package com.atxfinance.backend

import com.atxfinance.backend.config.AtxfinanceProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableConfigurationProperties(AtxfinanceProperties::class)
class Application

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}