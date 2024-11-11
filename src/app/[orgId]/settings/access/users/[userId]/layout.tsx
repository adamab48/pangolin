import { internal } from "@app/api";
import { AxiosResponse } from "axios";
import { redirect } from "next/navigation";
import { authCookieHeader } from "@app/api/cookies";
import { SidebarSettings } from "@app/components/SidebarSettings";
import { GetOrgUserResponse } from "@server/routers/user";
import OrgUserProvider from "@app/providers/OrgUserProvider";

interface UserLayoutProps {
    children: React.ReactNode;
    params: Promise<{ userId: string; orgId: string }>;
}

export default async function UserLayoutProps(props: UserLayoutProps) {
    const params = await props.params;

    const { children } = props;

    let user = null;
    try {
        const res = await internal.get<AxiosResponse<GetOrgUserResponse>>(
            `/org/${params.orgId}/user/${params.userId}`,
            await authCookieHeader()
        );
        user = res.data.data;
    } catch {
        redirect(`/${params.orgId}/settings/sites`);
    }

    const sidebarNavItems = [
        {
            title: "Access Controls",
            href: "/{orgId}/settings/access/users/{userId}/access-controls",
        },
    ];

    return (
        <>
            <OrgUserProvider orgUser={user}>
                <div className="space-y-0.5 select-none mb-6">
                    <h2 className="text-2xl font-bold tracking-tight">
                        User {user?.email}
                    </h2>
                    <p className="text-muted-foreground">Manage user</p>
                </div>

                <SidebarSettings
                    sidebarNavItems={sidebarNavItems}
                    limitWidth={true}
                >
                    {children}
                </SidebarSettings>
            </OrgUserProvider>
        </>
    );
}
