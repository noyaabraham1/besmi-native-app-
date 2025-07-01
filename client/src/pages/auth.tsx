import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  registerSchema,
  loginSchema,
  type RegisterData,
  type LoginData,
} from "@shared/schema";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  Sparkles,
  Users,
  Calendar,
  Star,
  Fingerprint,
} from "lucide-react";
import { z } from "zod";
import { OAuthRedirect } from "@/components/oauth-popup";
import { useMobileCapabilities } from "@/hooks/useMobileCapabilities";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { isNative, haptics } = useMobileCapabilities();
  const {
    isAvailable: biometricAvailable,
    authenticate: biometricAuth,
    biometricType,
  } = useBiometricAuth();

  // Handle OAuth error parameters and tab selection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");
    const provider = urlParams.get("provider");
    const tab = urlParams.get("tab");

    // Set active tab based on URL parameter
    if (tab === "signup") {
      setActiveTab("register");
    }

    if (error && provider) {
      let errorMessage = "";
      let errorTitle = "";

      switch (error) {
        case "restricted_browser":
          errorTitle = `${provider === "google" ? "Google" : "Apple"} Sign-in Unavailable`;
          errorMessage = `Please open this page in Chrome, Safari, or Firefox to sign in with ${provider === "google" ? "Google" : "Apple"}.`;
          break;
        case "browser_not_supported":
          errorTitle = "Browser Not Supported";
          errorMessage = `Your current browser doesn't support ${provider === "google" ? "Google" : "Apple"} sign-in. Please try a different browser.`;
          break;
        case "oauth_failed":
          errorTitle = "Sign-in Failed";
          errorMessage = `${provider === "google" ? "Google" : "Apple"} sign-in was unsuccessful. Please try again.`;
          break;
        default:
          errorTitle = "Authentication Error";
          errorMessage =
            "There was a problem signing you in. Please try again.";
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  // Forgot password schema
  const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
  });

  type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

  // Register form
  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  // Login form
  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  // Forgot password form
  const forgotPasswordForm = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await apiRequest("/api/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account created successfully!",
        description: "Welcome to Besmi. Let's set up your business profile.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/setup");
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ ...data, rememberMe }),
      });
      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Welcome back!",
        description: "You've been signed in successfully.",
      });

      // Force refresh authentication state
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/user"] });

      // Add delay for mobile environment to ensure state updates
      if (isNative) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Navigate to dashboard
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Sign in failed",
        description: error.message || "Invalid email or password.",
        variant: "destructive",
      });
    },
  });

  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordData) => {
      const response = await apiRequest("/api/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset email sent!",
        description:
          "Check your email for instructions to reset your password.",
      });
      setShowForgotPassword(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onRegisterSubmit = (data: RegisterData) => {
    registerMutation.mutate(data);
  };

  const onLoginSubmit = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  const handleBiometricLogin = async () => {
    await haptics.impact();

    try {
      const result = await biometricAuth();
      if (result.success) {
        // In a real implementation, this would validate stored credentials
        toast({
          title: "Biometric authentication successful",
          description: "Welcome back!",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        setLocation("/dashboard");
      } else {
        toast({
          title: "Authentication failed",
          description: result.error || "Biometric authentication was cancelled",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Authentication error",
        description: "Please try signing in with your password",
        variant: "destructive",
      });
    }
  };

  const onForgotPasswordSubmit = (data: ForgotPasswordData) => {
    forgotPasswordMutation.mutate(data);
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-white to-purple-100">
        <div className="bg-white/40 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-sm w-full">
          <Button
            variant="ghost"
            onClick={() => setShowForgotPassword(false)}
            className="mb-4 p-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to login
          </Button>
          <h2 className="text-2xl font-semibold text-center text-gray-800 mb-1">
            Reset Password
          </h2>
          <p className="text-sm text-center text-gray-600 mb-6">
            Enter your email to receive reset instructions
          </p>

          <form
            onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}
            className="space-y-4"
          >
            <div>
              <Label className="block text-sm font-medium text-gray-700">
                Email
              </Label>
              <Input
                type="email"
                placeholder="you@lashes.com"
                {...forgotPasswordForm.register("email")}
                className="w-full mt-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white/60 backdrop-blur-sm"
              />
              {forgotPasswordForm.formState.errors.email && (
                <p className="text-sm text-red-500 mt-1">
                  {forgotPasswordForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-2 rounded-lg transition-all duration-200"
              disabled={forgotPasswordMutation.isPending}
            >
              {forgotPasswordMutation.isPending
                ? "Sending..."
                : "Send Reset Email"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
      {/* Dynamic decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full mix-blend-overlay filter blur-xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-white/8 rounded-full mix-blend-overlay filter blur-xl opacity-25 animate-pulse animation-delay-700"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full mix-blend-overlay filter blur-2xl opacity-40 animate-pulse animation-delay-300"></div>
      </div>

      <div className="relative z-10">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/20 max-w-sm w-full mx-auto">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl font-bold text-black font-serif">
                B
              </span>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-center text-white mb-2">
            Welcome to Besmi
          </h2>
          <p className="text-sm text-center text-white/80 mb-6">
            Sign in to your lash artist platform
          </p>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/10 backdrop-blur-sm border border-white/20">
              <TabsTrigger
                value="login"
                className="text-white/80 data-[state=active]:bg-white data-[state=active]:text-black font-medium"
              >
                Log In
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="text-white/80 data-[state=active]:bg-white data-[state=active]:text-black font-medium"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form
                onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                className="space-y-4"
              >
                <div>
                  <Label className="block text-sm font-medium text-white/90">
                    Email
                  </Label>
                  <Input
                    type="email"
                    placeholder="you@lashes.com"
                    {...loginForm.register("email")}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/60"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-red-500 mt-1">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="block text-sm font-medium text-white/90">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...loginForm.register("password")}
                      className="w-full mt-1 px-4 py-2 pr-10 rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/60"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-white/10"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-white/60" />
                      ) : (
                        <Eye className="h-4 w-4 text-white/60" />
                      )}
                    </Button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-red-500 mt-1">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) =>
                        setRememberMe(checked as boolean)
                      }
                      className="mr-2"
                    />
                    <Label htmlFor="remember" className="text-sm text-gray-600">
                      Remember me
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-gray-600 hover:text-pink-400 hover:underline p-0"
                  >
                    Forgot password?
                  </Button>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 rounded-lg transition-all duration-200"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Log In"}
                </Button>

                {/* OAuth divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white/80 text-gray-500">
                      Or continue with
                    </span>
                  </div>
                </div>

                {/* OAuth buttons */}
                <div className="space-y-3">
                  <OAuthRedirect
                    provider="google"
                    onSuccess={() => {
                      toast({
                        title: "Welcome to Besmi!",
                        description: "Successfully signed in with Google.",
                      });
                      queryClient.invalidateQueries({
                        queryKey: ["/api/user"],
                      });
                      setLocation("/");
                    }}
                    onError={(error: string) => {
                      toast({
                        title: "Google sign-in failed",
                        description: error,
                        variant: "destructive",
                      });
                    }}
                  >
                    <div className="w-full bg-white/60 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg transition-all duration-200 flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continue with Google
                    </div>
                  </OAuthRedirect>

                  <OAuthRedirect
                    provider="apple"
                    onSuccess={() => {
                      toast({
                        title: "Welcome to Besmi!",
                        description: "Successfully signed in with Apple.",
                      });
                      queryClient.invalidateQueries({
                        queryKey: ["/api/user"],
                      });
                      setLocation("/");
                    }}
                    onError={(error: string) => {
                      toast({
                        title: "Apple sign-in failed",
                        description: error,
                        variant: "destructive",
                      });
                    }}
                  >
                    <div className="w-full bg-white/60 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg transition-all duration-200 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 mr-2"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      Continue with Apple
                    </div>
                  </OAuthRedirect>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form
                onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-medium text-gray-700">
                      First Name
                    </Label>
                    <Input
                      type="text"
                      placeholder="Jane"
                      {...registerForm.register("firstName")}
                      className="w-full mt-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white/60 backdrop-blur-sm"
                    />
                    {registerForm.formState.errors.firstName && (
                      <p className="text-sm text-red-500 mt-1">
                        {registerForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700">
                      Last Name
                    </Label>
                    <Input
                      type="text"
                      placeholder="Doe"
                      {...registerForm.register("lastName")}
                      className="w-full mt-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white/60 backdrop-blur-sm"
                    />
                    {registerForm.formState.errors.lastName && (
                      <p className="text-sm text-red-500 mt-1">
                        {registerForm.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="block text-sm font-medium text-gray-700">
                    Email
                  </Label>
                  <Input
                    type="email"
                    placeholder="you@lashes.com"
                    {...registerForm.register("email")}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white/80 backdrop-blur-sm"
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-red-500 mt-1">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="block text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...registerForm.register("password")}
                      className="w-full mt-1 px-4 py-2 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white/80 backdrop-blur-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setShowRegisterPassword(!showRegisterPassword)
                      }
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    >
                      {showRegisterPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-red-500 mt-1">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 rounded-lg transition-all duration-200"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending
                    ? "Creating account..."
                    : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-center text-gray-600 mt-4">
            {activeTab === "login" ? (
              <>
                New to Besmi?{" "}
                <Button
                  variant="link"
                  onClick={() => setActiveTab("register")}
                  className="text-gray-600 hover:text-pink-400 hover:underline p-0 text-xs"
                >
                  Create an account
                </Button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Button
                  variant="link"
                  onClick={() => setActiveTab("login")}
                  className="text-gray-600 hover:text-pink-400 hover:underline p-0 text-xs"
                >
                  Log in
                </Button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
