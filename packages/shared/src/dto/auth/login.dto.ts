export interface LoginDto {
  username: string;
  password: string;
  organizationId?: string;
}

export interface LoginResponseDto {
  accessToken: string;
  principal: {
    id: string;
    username: string;
    roles: string[];
    permissions: string[];
    organizationId: string;
  };
}
