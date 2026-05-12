package com.strawberry.ecommerce.sync.service;

import com.strawberry.ecommerce.sync.config.RabbitMQConfig;
import com.strawberry.ecommerce.sync.dto.SyncJobMessage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SyncMessageProducer {

    private static final Logger logger = LoggerFactory.getLogger(SyncMessageProducer.class);
    private final RabbitTemplate rabbitTemplate;

    public void publishSyncJob(SyncJobMessage message) {
        logger.info("Publishing Sync Job info to RabbitMQ: {}", message);
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_SYNC, RabbitMQConfig.ROUTING_KEY_SYNC_JOBS, message);
    }
}
