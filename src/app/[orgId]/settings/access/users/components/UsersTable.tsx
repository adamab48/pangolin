"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@app/components/ui/dropdown-menu";
import { Button } from "@app/components/ui/button";
import { ArrowUpDown, Crown, MoreHorizontal } from "lucide-react";
import { UsersDataTable } from "./UsersDataTable";
import { useState } from "react";
import InviteUserForm from "./InviteUserForm";
import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
import { useUserContext } from "@app/hooks/useUserContext";
import api from "@app/api";
import { useOrgContext } from "@app/hooks/useOrgContext";
import { useToast } from "@app/hooks/useToast";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type UserRow = {
    id: string;
    email: string;
    status: string;
    role: string;
    isOwner: boolean;
};

type UsersTableProps = {
    users: UserRow[];
};

export default function UsersTable({ users: u }: UsersTableProps) {
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

    const [users, setUsers] = useState<UserRow[]>(u);

    const router = useRouter();

    const user = useUserContext();
    const { org } = useOrgContext();
    const { toast } = useToast();

    const columns: ColumnDef<UserRow>[] = [
        {
            accessorKey: "email",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        Email
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
        },
        {
            accessorKey: "status",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        Status
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
        },
        {
            accessorKey: "role",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        Role
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const userRow = row.original;

                return (
                    <div className="flex flex-row items-center gap-1">
                        {userRow.isOwner && <Crown className="w-4 h-4" />}
                        <span>{userRow.role}</span>
                    </div>
                );
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const userRow = row.original;

                return (
                    <>
                        {!userRow.isOwner && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                    >
                                        <span className="sr-only">
                                            Open menu
                                        </span>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem>
                                        <Link
                                            href={`/${org?.org.orgId}/settings/access/users/${userRow.id}`}
                                        >
                                            Manage User
                                        </Link>
                                    </DropdownMenuItem>
                                    {userRow.email !== user?.email && (
                                        <DropdownMenuItem>
                                            <button
                                                className="text-red-600 hover:text-red-800"
                                                onClick={() => {
                                                    setIsDeleteModalOpen(true);
                                                    setSelectedUser(userRow);
                                                }}
                                            >
                                                Remove User
                                            </button>
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </>
                );
            },
        },
    ];

    async function removeUser() {
        if (selectedUser) {
            const res = await api
                .delete(`/org/${org!.org.orgId}/user/${selectedUser.id}`)
                .catch((e) => {
                    toast({
                        variant: "destructive",
                        title: "Failed to remove user",
                        description:
                            e.message ??
                            "An error occurred while removing the user.",
                    });
                });

            if (res && res.status === 200) {
                toast({
                    variant: "default",
                    title: "User removed",
                    description: `The user ${selectedUser.email} has been removed from the organization.`,
                });

                setUsers((prev) =>
                    prev.filter((u) => u.id !== selectedUser?.id)
                );
            }
        }
        setIsDeleteModalOpen(false);
    }

    return (
        <>
            <ConfirmDeleteDialog
                open={isDeleteModalOpen}
                setOpen={(val) => {
                    setIsDeleteModalOpen(val);
                    setSelectedUser(null);
                }}
                dialog={
                    <div>
                        <p className="mb-2">
                            Are you sure you want to remove{" "}
                            <b>{selectedUser?.email}</b> from the organization?
                        </p>

                        <p className="mb-2">
                            Once removed, this user will no longer have access
                            to the organization. You can always re-invite them
                            later, but they will need to accept the invitation
                            again.
                        </p>

                        <p>
                            To confirm, please type the email address of the
                            user below.
                        </p>
                    </div>
                }
                buttonText="Confirm remove user"
                onConfirm={removeUser}
                string={selectedUser?.email ?? ""}
                title="Remove user from organization"
            />

            <InviteUserForm
                open={isInviteModalOpen}
                setOpen={setIsInviteModalOpen}
            />

            <UsersDataTable
                columns={columns}
                data={users}
                inviteUser={() => {
                    setIsInviteModalOpen(true);
                }}
            />
        </>
    );
}
