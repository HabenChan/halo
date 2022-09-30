package run.halo.app.theme.router;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationListener;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;
import run.halo.app.infra.exception.NotFoundException;
import run.halo.app.theme.DefaultTemplateEnum;
import run.halo.app.theme.router.strategy.ArchivesRouteStrategy;
import run.halo.app.theme.router.strategy.CategoriesRouteStrategy;
import run.halo.app.theme.router.strategy.CategoryRouteStrategy;
import run.halo.app.theme.router.strategy.IndexRouteStrategy;
import run.halo.app.theme.router.strategy.PostRouteStrategy;
import run.halo.app.theme.router.strategy.SinglePageRouteStrategy;
import run.halo.app.theme.router.strategy.TagRouteStrategy;
import run.halo.app.theme.router.strategy.TagsRouteStrategy;

/**
 * Theme template router mapping manager.
 *
 * @author guqing
 * @see PermalinkIndexer
 * @see PermalinkPatternProvider
 * @see TemplateRouterStrategy
 * @since 2.0.0
 */
@Component
public class TemplateRouteManager implements ApplicationListener<ApplicationReadyEvent> {

    private final ReentrantReadWriteLock.WriteLock writeLock =
        new ReentrantReadWriteLock().writeLock();
    private final Map<String, RouterFunction<ServerResponse>> routerFunctionMap = new HashMap<>();
    private final PermalinkPatternProvider permalinkPatternProvider;
    private final ApplicationContext applicationContext;

    public TemplateRouteManager(PermalinkPatternProvider permalinkPatternProvider,
        ApplicationContext applicationContext) {
        this.permalinkPatternProvider = permalinkPatternProvider;
        this.applicationContext = applicationContext;
    }

    public Map<String, RouterFunction<ServerResponse>> getRouterFunctionMap() {
        return Map.copyOf(this.routerFunctionMap);
    }

    /**
     * Change the template router function.
     *
     * @param templateName template name
     * @return a new {@link RouterFunction} generated by the template router strategy
     */
    public RouterFunction<ServerResponse> changeTemplatePattern(String templateName) {
        String pattern = getPatternByTemplateName(templateName);
        RouterFunction<ServerResponse> routeFunction = templateRouterStrategy(templateName)
            .getRouteFunction(templateName, pattern);
        writeLock.lock();
        try {
            routerFunctionMap.remove(templateName);
            routerFunctionMap.put(templateName, routeFunction);
        } finally {
            writeLock.unlock();
        }
        return routeFunction;
    }

    private String getPatternByTemplateName(String templateName) {
        DefaultTemplateEnum templateEnum = DefaultTemplateEnum.convertFrom(templateName);
        if (templateEnum == null) {
            throw new IllegalArgumentException("Template name is not valid");
        }
        return permalinkPatternProvider.getPattern(templateEnum);
    }

    /**
     * Register router mapping by template name.
     *
     * @param templateName template name
     */
    public void register(String templateName) {
        String pattern = getPatternByTemplateName(templateName);
        RouterFunction<ServerResponse> routeFunction = templateRouterStrategy(templateName)
            .getRouteFunction(templateName, pattern);
        if (routeFunction == null) {
            throw new IllegalStateException("Router function must not be null");
        }
        writeLock.lock();
        try {
            routerFunctionMap.put(templateName, routeFunction);
        } finally {
            writeLock.unlock();
        }
    }

    void initRouterMapping() {
        for (DefaultTemplateEnum templateEnum : DefaultTemplateEnum.values()) {
            String templateName = templateEnum.getValue();
            register(templateName);
        }
    }

    @NonNull
    private TemplateRouterStrategy templateRouterStrategy(String template) {
        DefaultTemplateEnum value = DefaultTemplateEnum.convertFrom(template);
        if (value == null) {
            throw new NotFoundException("Unknown template: " + template);
        }

        return switch (value) {
            case INDEX -> applicationContext.getBean(IndexRouteStrategy.class);
            case POST -> applicationContext.getBean(PostRouteStrategy.class);
            case ARCHIVES -> applicationContext.getBean(ArchivesRouteStrategy.class);
            case TAGS -> applicationContext.getBean(TagsRouteStrategy.class);
            case TAG -> applicationContext.getBean(TagRouteStrategy.class);
            case CATEGORIES -> applicationContext.getBean(CategoriesRouteStrategy.class);
            case CATEGORY -> applicationContext.getBean(CategoryRouteStrategy.class);
            case SINGLE_PAGE -> applicationContext.getBean(SinglePageRouteStrategy.class);
        };
    }

    @Override
    public void onApplicationEvent(@NonNull ApplicationReadyEvent event) {
        initRouterMapping();
    }
}