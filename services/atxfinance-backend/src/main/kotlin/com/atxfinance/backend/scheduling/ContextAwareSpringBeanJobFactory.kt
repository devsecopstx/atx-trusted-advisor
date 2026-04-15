package com.atxfinance.backend.scheduling

import org.quartz.spi.TriggerFiredBundle
import org.springframework.context.ApplicationContext
import org.springframework.scheduling.quartz.SpringBeanJobFactory

/**
 * Lets Quartz instantiate [QuartzJobBean] subclasses as Spring beans so constructor injection works.
 */
class ContextAwareSpringBeanJobFactory(
    private val applicationContext: ApplicationContext,
) : SpringBeanJobFactory() {
    override fun createJobInstance(bundle: TriggerFiredBundle): Any {
        val job = super.createJobInstance(bundle)
        applicationContext.autowireCapableBeanFactory.autowireBean(job)
        return job
    }
}
