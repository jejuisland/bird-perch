export type VehicleType = 'motorcycle' | 'sedan' | 'suv' | 'van';
export interface User {
    id: string;
    name: string;
    email: string;
    mobileNumber: string;
    age: number;
    vehicleType: VehicleType;
    createdAt: string;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface LoginDto {
    email: string;
    password: string;
}
export interface RegisterDto {
    name: string;
    email: string;
    password: string;
    mobileNumber: string;
    age: number;
    vehicleType: VehicleType;
}
