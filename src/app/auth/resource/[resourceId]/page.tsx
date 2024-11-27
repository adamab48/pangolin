import {
    GetResourceAuthInfoResponse,
    GetResourceResponse,
} from "@server/routers/resource";
import ResourceAuthPortal from "./components/ResourceAuthPortal";
import { internal, priv } from "@app/api";
import { AxiosResponse } from "axios";
import { authCookieHeader } from "@app/api/cookies";
import { cache } from "react";
import { verifySession } from "@app/lib/auth/verifySession";
import { redirect } from "next/navigation";
import ResourceNotFound from "./components/ResourceNotFound";
import ResourceAccessDenied from "./components/ResourceAccessDenied";
import { cookies } from "next/headers";
import { CheckResourceSessionResponse } from "@server/routers/auth";

export default async function ResourceAuthPage(props: {
    params: Promise<{ resourceId: number }>;
    searchParams: Promise<{ redirect: string | undefined }>;
}) {
    const params = await props.params;
    const searchParams = await props.searchParams;

    let authInfo: GetResourceAuthInfoResponse | undefined;
    try {
        const res = await internal.get<
            AxiosResponse<GetResourceAuthInfoResponse>
        >(`/resource/${params.resourceId}/auth`, await authCookieHeader());

        if (res && res.status === 200) {
            authInfo = res.data.data;
        }
    } catch (e) {}

    const getUser = cache(verifySession);
    const user = await getUser();

    if (!authInfo) {
        return (
            <div className="w-full max-w-md">
                <ResourceNotFound />
            </div>
        );
    }

    const hasAuth = authInfo.password || authInfo.pincode || authInfo.sso;
    const isSSOOnly = authInfo.sso && !authInfo.password && !authInfo.pincode;

    const redirectUrl = searchParams.redirect || authInfo.url;

    const allCookies = await cookies();
    const cookieName =
        process.env.RESOURCE_SESSION_COOKIE_NAME + `_${params.resourceId}`;
    const sessionId = allCookies.get(cookieName)?.value ?? null;

    if (sessionId) {
        let doRedirect = false;
        try {
            const res = await priv.get<
                AxiosResponse<CheckResourceSessionResponse>
            >(`/resource-session/${params.resourceId}/${sessionId}`);

            console.log("resource session already exists and is valid");

            if (res && res.data.data.valid) {
                doRedirect = true;
            }
        } catch (e) {
            console.error(e);
        }

        if (doRedirect) {
            redirect(redirectUrl);
        }
    }

    if (!hasAuth) {
        // no authentication so always go straight to the resource
        redirect(redirectUrl);
    }

    let userIsUnauthorized = false;
    if (user && authInfo.sso) {
        let doRedirect = false;
        try {
            const res = await internal.get<AxiosResponse<GetResourceResponse>>(
                `/resource/${params.resourceId}`,
                await authCookieHeader(),
            );

            console.log(res.data);
            doRedirect = true;
        } catch (e) {
            console.error(e);
            userIsUnauthorized = true;
        }

        if (doRedirect) {
            redirect(redirectUrl);
        }
    }

    if (userIsUnauthorized && isSSOOnly) {
        return (
            <div className="w-full max-w-md">
                <ResourceAccessDenied />
            </div>
        );
    }

    return (
        <>
            <div className="w-full max-w-md">
                <ResourceAuthPortal
                    methods={{
                        password: authInfo.password,
                        pincode: authInfo.pincode,
                        sso: authInfo.sso && !userIsUnauthorized,
                    }}
                    resource={{
                        name: authInfo.resourceName,
                        id: authInfo.resourceId,
                    }}
                    redirect={redirectUrl}
                />
            </div>
        </>
    );
}
