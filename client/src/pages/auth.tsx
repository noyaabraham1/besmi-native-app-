// client/src/pages/auth.tsx
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { OAuthRedirect } from "@/components/oauth-redirect";
import { useMobileCapabilities } from "@/hooks/useMobileCapabilities";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

// Enhanced validation schemas
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;
type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const { isNative, haptics } = useMobileCapabilities();
  const {
    isAvailable: biometricAvailable,
    authenticate: biometricAuth,
    biometricType
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
      switch (error) {
        case "disallowed_useragent":
          errorMessage = `Please open this page in your regular browser (Chrome, Safari, Firefox) instead of ${provider}`;
          break;
        case "access_denied":
          errorMessage = `Access was denied. Please try signing in with ${provider} again.`;
          break;
        case "popup_blocked":
          errorMessage = "Popup was blocked. Please allow popups and try again.";
          break;
        default:
          errorMessage = `Something went wrong with ${provider} sign-in. Please try again.`;
      }

      toast({
        title: `${provider} Sign-in Error`,
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [toast]);

  // Form configurations
  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const forgotPasswordForm = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  // Registration mutation
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
        title: "Welcome to Besmi!",
        description: "Your account has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Enhanced login mutation with biometric setup
  const loginMutationWithBiometric = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: async (user) => {
      toast({
        title: "Welcome back!",
        description: "Successfully signed in to your account.",
      });
      
      // Offer biometric setup on successful login
      if (isNative && biometricAvailable && rememberMe) {
        const hasExistingBiometric = localStorage.getItem('biometric_credentials');
        
        if (!hasExistingBiometric) {
          // Store credentials for biometric login
          const credentials = {
            email: loginForm.getValues('email'),
            timestamp: Date.now()
          };
          localStorage.setItem('biometric_credentials', JSON.stringify(credentials));
          
          setTimeout(() => {
            toast({
              title: "Biometric login available",
              description: `You can now use ${biometricType === 'face' ? 'Face ID' : 'fingerprint'} to sign in quickly`
            });
          }, 2000);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Add mobile-specific delay for proper state synchronization
      if (isNative) {
        setTimeout(() => setLocation("/"), 500);
      } else {
        setLocation("/");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Sign in failed",
        description: error.message || "Invalid email or password.",
        variant: "destructive",
      });
    },
  });

  // Legacy login mutation for compatibility
  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "Successfully signed in to your account.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
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
    loginMutationWithBiometric.mutate(data);
  };

  const handleBiometricLogin = async () => {
    try {
      await haptics.impact();
      
      const result = await biometricAuth();
      
      if (result.success) {
        // Check if user has saved credentials for biometric login
        const savedCredentials = localStorage.getItem('biometric_credentials');
        
        if (savedCredentials) {
          const { email } = JSON.parse(savedCredentials);
          
          // Create a mock login for biometric authentication
          toast({
            title: "Biometric authentication successful",
            description: "Welcome back to Besmi!",
          });
          
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          setLocation("/");
        } else {
          toast({
            title: "Set up biometric login",
            description: "Please sign in with your password first to enable biometric authentication",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      toast({
        title: "Authentication failed",
        description: "Please try signing in with your password",
        variant: "destructive"
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
            Back to Login
          </Button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-serif text-2xl font-bold">B</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
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
                : "Send Reset Link"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-white/5 rounded-full blur-xl"></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-white/3 rounded-full blur-2xl"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-radial from-white/10 to-transparent rounded-full blur-3xl"></div>

      <div className="relative z-10 bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/90 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-black font-serif text-3xl font-bold">B</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to Besmi</h1>
          <p className="text-white/70 text-sm">Your professional lash business platform</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/10 backdrop-blur-sm border border-white/20">
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
                    className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-black"
                  />
                  <Label
                    htmlFor="remember"
                    className="ml-2 text-sm text-white/80 cursor-pointer"
                  >
                    Remember me
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-gray-600 hover:text-pink-400 hover:underline p-0"
                >
                  Forgot password?
                </Button>
              </div>

              <Button
                type="submit"
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 rounded-lg transition-all duration-200"
                disabled={loginMutationWithBiometric.isPending}
              >
                {loginMutationWithBiometric.isPending ? "Signing in..." : "Log In"}
              </Button>

              {/* Biometric Sign-In Button */}
              {isNative && biometricAvailable && (
                <Button
                  type="button"
                  onClick={handleBiometricLogin}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 border border-white/20"
                >
                  {biometricType === 'face' ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3 0 2-3 7.5-3 7.5S9 10 9 8c0-1.66 1.34-3 3-3z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.27.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.29-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.69-2.5 1.65-3.4 2.94-.08.14-.23.21-.39.21z"/>
                    </svg>
                  )}
                  Sign in with {biometricType === 'face' ? 'Face ID' : 'Fingerprint'}
                </Button>
              )}

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
              </div>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form
              onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
              className="space-y-4"
            >
              <div>
                <Label className="block text-sm font-medium text-white/90">
                  Full Name
                </Label>
                <Input
                  type="text"
                  placeholder="Your Name"
                  {...registerForm.register("name")}
                  className="w-full mt-1 px-4 py-2 rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/60"
                />
                {registerForm.formState.errors.name && (
                  <p className="text-sm text-red-500 mt-1">
                    {registerForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="block text-sm font-medium text-white/90">
                  Email
                </Label>
                <Input
                  type="email"
                  placeholder="you@lashes.com"
                  {...registerForm.register("email")}
                  className="w-full mt-1 px-4 py-2 rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/60"
                />
                {registerForm.formState.errors.email && (
                  <p className="text-sm text-red-500 mt-1">
                    {registerForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="block text-sm font-medium text-white/90">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    type={showRegisterPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...registerForm.register("password")}
                    className="w-full mt-1 px-4 py-2 pr-10 rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/60"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setShowRegisterPassword(!showRegisterPassword)
                    }
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-white/10"
                  >
                    {showRegisterPassword ? (
                      <EyeOff className="h-4 w-4 text-white/60" />
                    ) : (
                      <Eye className="h-4 w-4 text-white/60" />
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
                {registerMutation.isPending ? "Creating account..." : "Sign Up"}
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
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
