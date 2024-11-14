import { internal } from "@app/api";
import { authCookieHeader } from "@app/api/cookies";
import ResourcesTable, { ResourceRow } from "./components/ResourcesTable";
import { AxiosResponse } from "axios";
import { ListResourcesResponse } from "@server/routers/resource";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";

type ResourcesPageProps = {
    params: Promise<{ orgId: string }>;
};

export default async function ResourcesPage(props: ResourcesPageProps) {
    const params = await props.params;
    let resources: ListResourcesResponse["resources"] = [];
    try {
        const res = await internal.get<AxiosResponse<ListResourcesResponse>>(
            `/org/${params.orgId}/resources`,
            await authCookieHeader()
        );
        resources = res.data.data.resources;
    } catch (e) {
        console.error("Error fetching resources", e);
    }

    const resourceRows: ResourceRow[] = resources.map((resource) => {
        return {
            id: resource.resourceId,
            name: resource.name,
            orgId: params.orgId,
            domain: resource.subdomain || "",
            site: resource.siteName || "None",
        };
    });

    return (
        <>
            <SettingsSectionTitle
                title="Manage Resources"
                description="Create secure proxies to your private applications"
            />

            <ResourcesTable resources={resourceRows} orgId={params.orgId} />
        </>
    );
}
