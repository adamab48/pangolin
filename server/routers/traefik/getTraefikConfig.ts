import { Request, Response } from "express";
import db from "@server/db";
import * as schema from "@server/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import logger from "@server/logger";
import HttpCode from "@server/types/HttpCode";
import config from "@server/config";

export async function traefikConfigProvider(
    _: Request,
    res: Response,
): Promise<any> {
    try {
        const all = await db
            .select()
            .from(schema.targets)
            .innerJoin(
                schema.resources,
                eq(schema.targets.resourceId, schema.resources.resourceId),
            )
            .innerJoin(
                schema.orgs,
                eq(schema.resources.orgId, schema.orgs.orgId),
            )
            .innerJoin(
                schema.sites,
                eq(schema.sites.siteId, schema.resources.siteId),
            )
            .where(
                and(
                    eq(schema.targets.enabled, true),
                    isNotNull(schema.resources.subdomain),
                    isNotNull(schema.orgs.domain),
                ),
            );

        if (!all.length) {
            return res.status(HttpCode.OK).json({});
        }

        const badgerMiddlewareName = "badger";
        const redirectMiddlewareName = "redirect-to-https";

        // const baseDomain = new URL(config.app.base_url).hostname;

        const http: any = {
            routers: {},
            services: {},
            middlewares: {
                [badgerMiddlewareName]: {
                    plugin: {
                        [badgerMiddlewareName]: {
                            apiBaseUrl: new URL(
                                "/api/v1",
                                `http://${config.server.internal_hostname}:${config.server.internal_port}`,
                            ).href,
                            resourceSessionCookieName:
                                config.badger.resource_session_cookie_name,
                            userSessionCookieName:
                                config.server.session_cookie_name,
                            sessionQueryParameter:
                                config.badger.session_query_parameter,
                        },
                    },
                },
                [redirectMiddlewareName]: {
                    redirectScheme: {
                        scheme: "https",
                        permanent: true,
                    },
                },
            },
        };
        for (const item of all) {
            const target = item.targets;
            const resource = item.resources;
            const site = item.sites;
            const org = item.orgs;

            const routerName = `${target.targetId}-router`;
            const serviceName = `${target.targetId}-service`;

            if (!resource || !resource.subdomain) {
                continue;
            }

            if (!org || !org.domain) {
                continue;
            }

            const fullDomain = `${resource.subdomain}.${org.domain}`;

            const domainParts = fullDomain.split(".");
            let wildCard;
            if (domainParts.length <= 2) {
                wildCard = `*.${domainParts.join(".")}`;
            } else {
                wildCard = `*.${domainParts.slice(1).join(".")}`;
            }

            const tls = {
                certResolver: config.traefik.cert_resolver,
                ...(config.traefik.prefer_wildcard_cert
                    ? {
                          domains: [
                              {
                                  main: wildCard,
                              },
                          ],
                      }
                    : {}),
            };

            http.routers![routerName] = {
                entryPoints: [
                    resource.ssl
                        ? config.traefik.https_entrypoint
                        : config.traefik.http_entrypoint,
                ],
                middlewares: [badgerMiddlewareName],
                service: serviceName,
                rule: `Host(\`${fullDomain}\`)`,
                ...(resource.ssl ? { tls } : {}),
            };

            if (resource.ssl) {
                // this is a redirect router; all it does is redirect to the https version if tls is enabled
                http.routers![routerName + "-redirect"] = {
                    entryPoints: [config.traefik.http_entrypoint],
                    middlewares: [redirectMiddlewareName],
                    service: serviceName,
                    rule: `Host(\`${fullDomain}\`)`,
                };
            }

            if (site.type === "newt") {
                const ip = site.subnet.split("/")[0];
                http.services![serviceName] = {
                    loadBalancer: {
                        servers: [
                            {
                                url: `${target.method}://${ip}:${target.internalPort}`,
                            },
                        ],
                    },
                };
            } else if (site.type === "wireguard") {
                http.services![serviceName] = {
                    loadBalancer: {
                        servers: [
                            {
                                url: `${target.method}://${target.ip}:${target.port}`,
                            },
                        ],
                    },
                };
            }
        }

        return res.status(HttpCode.OK).json({ http });
    } catch (e) {
        logger.error(`Failed to build traefik config: ${e}`);
        return res.status(HttpCode.INTERNAL_SERVER_ERROR).json({
            error: "Failed to build traefik config",
        });
    }
}
