package com.strawberry.ecommerce.sync.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_SYNC = "wb.sync.exchange";

    public static final String QUEUE_SYNC_JOBS = "wb_sync_jobs_queue";
    public static final String QUEUE_SYNC_DLQ = "wb_sync_dlq";

    public static final String ROUTING_KEY_SYNC_JOBS = "wb.sync.jobs";

    @Bean
    public DirectExchange syncExchange() {
        return new DirectExchange(EXCHANGE_SYNC);
    }

    @Bean
    public Queue syncJobsQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange", ""); // Default exchange
        args.put("x-dead-letter-routing-key", QUEUE_SYNC_DLQ);
        return new Queue(QUEUE_SYNC_JOBS, true, false, false, args);
    }

    @Bean
    public Queue deadLetterQueue() {
        return new Queue(QUEUE_SYNC_DLQ, true);
    }

    @Bean
    public Binding bindingSyncJobsConfig(Queue syncJobsQueue, DirectExchange syncExchange) {
        return BindingBuilder.bind(syncJobsQueue).to(syncExchange).with(ROUTING_KEY_SYNC_JOBS);
    }

    @Bean
    public JacksonJsonMessageConverter messageConverter() {
        return new JacksonJsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        return template;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter());
        return factory;
    }
}
