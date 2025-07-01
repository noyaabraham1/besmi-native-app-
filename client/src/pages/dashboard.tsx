import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useOfflineMode } from "@/hooks/useOfflineMode";

import { 
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  Plus,
  ExternalLink,
  Palette,
  Clock,
  Check,
  X,
  AlertCircle,
  Scissors,
  Edit,
  Trophy,
  Star,
  Target,
  Zap,
  Minimize2,
  XIcon,
  Share2,
  Copy,
  FileText,
  Heart,
  Sparkles,
  UserX,
  ArrowRight,
  MessageCircle
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { Business, Appointment, Client, Service } from "@shared/schema";
import { useBusinessTimezone } from "@/hooks/use-business-timezone";
import BusinessInsights from "@/components/business-insights";
import { OnboardingGuide } from "@/components/onboarding-guide";
import { useMobileApp } from "@/hooks/useMobileApp";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { isMobileApp, openExternalBrowser } = useMobileApp();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const businessTimezone = useBusinessTimezone();
  const [showPendingDialog, setShowPendingDialog] = useState(false);

  const { data: business } = useQuery<Business>({
    queryKey: ["/api/business"],
  });

  const { data: appointments = [] } = useQuery<(Appointment & { client: Client; service: Service })[]>({
    queryKey: ["/api/appointments"],
    staleTime: 0, // Always refetch for fresh checkout data
    gcTime: 0, // Don't cache appointment data (React Query v5)
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchInterval: 5000, // Auto-refetch every 5 seconds for real-time updates
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  // Query for pending appointment requests
  const { data: pendingAppointments = [] } = useQuery<(Appointment & { client: Client; service: Service })[]>({
    queryKey: ["/api/appointments/pending"],
  });

  // Initialize offline mode and cache data
  const { 
    isOnline, 
    queuedActions, 
    lastSyncTime, 
    cacheOfflineData, 
    forceSyncAll 
  } = useOfflineMode();

  // Cache data when queries succeed
  useEffect(() => {
    if (isOnline && business && appointments && clients && services) {
      cacheOfflineData({
        business,
        appointments,
        clients,
        services
      });
    }
  }, [business, appointments, clients, services, isOnline, cacheOfflineData]);

  // Mutations for confirming/denying appointments
  const confirmMutation = useMutation({
    mutationFn: (appointmentId: string) => 
      apiRequest(`/api/appointments/${appointmentId}/confirm`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/pending"] });
    }
  });

  const denyMutation = useMutation({
    mutationFn: (appointmentId: string) => 
      apiRequest(`/api/appointments/${appointmentId}/deny`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/pending"] });
    }
  });

  // Calculate today's appointments and revenue in business timezone
  const today = new Date();
  const todayAppointments = (Array.isArray(appointments) ? appointments : []).filter(apt => {
    if (!businessTimezone.formatDate) return false;
    
    // Convert appointment time to business timezone for date comparison
    const aptBusinessDate = businessTimezone.formatDate(apt.startTime, 'yyyy-MM-dd');
    const todayBusinessDate = businessTimezone.formatDate(today, 'yyyy-MM-dd');
    
    return aptBusinessDate === todayBusinessDate;
  });

  const todayRevenue = todayAppointments.reduce((sum, apt) => sum + (parseFloat(apt.service?.price || "0")), 0);

  // Calculate this week's stats in business timezone
  const weekAppointments = (Array.isArray(appointments) ? appointments : []).filter(apt => {
    if (!format) return false;
    
    // Get week boundaries in business timezone
    const todayBusinessDate = format(today, 'yyyy-MM-dd');
    const aptBusinessDate = format(apt.startTime, 'yyyy-MM-dd');
    
    const todayDate = new Date(todayBusinessDate);
    const weekStart = new Date(todayDate);
    weekStart.setDate(todayDate.getDate() - todayDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const aptDateObj = new Date(aptBusinessDate);
    return aptDateObj >= weekStart && aptDateObj <= weekEnd;
  });

  const weekRevenue = weekAppointments.reduce((sum, apt) => sum + (parseFloat(apt.service?.price || "0")), 0);

  // Calculate this month's stats in business timezone
  const monthAppointments = (Array.isArray(appointments) ? appointments : []).filter(apt => {
    if (!format) return false;
    
    const aptBusinessDate = format(apt.startTime, 'yyyy-MM');
    const currentMonth = format(today, 'yyyy-MM');
    
    return aptBusinessDate === currentMonth;
  });

  const monthRevenue = monthAppointments.reduce((sum, apt) => sum + (parseFloat(apt.service?.price || "0")), 0);
  const monthClients = monthAppointments.length;

  // Calculate percentage change from last month in business timezone
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  
  const lastMonthAppointments = (Array.isArray(appointments) ? appointments : []).filter(apt => {
    if (!format) return false;
    
    const aptBusinessDate = format(apt.startTime, 'yyyy-MM');
    const lastMonthStr = format(lastMonth, 'yyyy-MM');
    
    return aptBusinessDate === lastMonthStr;
  });
  
  const lastMonthRevenue = lastMonthAppointments.reduce((sum, apt) => sum + (parseFloat(apt.service?.price || "0")), 0);
  const monthlyGrowth = lastMonthRevenue > 0 ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

  // Calculate YTD (Year-to-Date) revenue in business timezone
  const ytdAppointments = (Array.isArray(appointments) ? appointments : []).filter(apt => {
    if (!format) return false;
    
    const aptBusinessYear = format(apt.startTime, 'yyyy');
    const currentYear = format(today, 'yyyy');
    
    return aptBusinessYear === currentYear && apt.status === 'confirmed';
  });
  const ytdRevenue = ytdAppointments.reduce((sum, apt) => sum + (parseFloat(apt.service?.price || "0")), 0);

  // Calculate scheduled earnings (all upcoming appointments) in business timezone
  const futureAppointments = (Array.isArray(appointments) ? appointments : []).filter(apt => {
    if (!format) return false;
    
    const aptBusinessTime = new Date(format(apt.startTime, 'yyyy-MM-dd HH:mm:ss'));
    const nowBusinessTime = new Date(format(today, 'yyyy-MM-dd HH:mm:ss'));
    
    return aptBusinessTime > nowBusinessTime && (apt.status === 'confirmed' || apt.status === 'pending');
  });
  
  const scheduledEarnings = futureAppointments.reduce((sum, apt) => sum + (parseFloat(apt.service?.price || "0")), 0);

  // Calculate appointments needing checkout (confirmed appointments 1+ hours past end time, excluding completed)
  const checkoutReadyAppointments = (Array.isArray(appointments) ? appointments : []).filter(apt => {
    // Only include confirmed appointments (exclude completed, cancelled, etc.)
    if (apt.status !== 'confirmed') return false;
    
    const appointmentEnd = new Date(apt.endTime);
    const oneHourAfterEnd = new Date(appointmentEnd.getTime() + (60 * 60 * 1000));
    const isReady = today > oneHourAfterEnd;
    
    return isReady;
  });

  // Calculate onboarding progress
  const onboardingSteps = [
    {
      id: 'business-setup',
      title: 'Business Profile Created',
      description: 'Set up your business information',
      completed: !!business,
      icon: Check,
      points: 25
    },
    {
      id: 'first-service',
      title: 'First Service Added',
      description: 'Create your first service offering',
      completed: services.length > 0,
      icon: Scissors,
      points: 25
    },
    {
      id: 'customization',
      title: 'Brand Customization',
      description: 'Customize your booking page colors',
      completed: business?.brandColor && business.brandColor !== '#FF8DC7',
      icon: Palette,
      points: 20
    },
    {
      id: 'first-booking',
      title: 'First Booking Received',
      description: 'Get your first client booking',
      completed: appointments.length > 0,
      icon: Calendar,
      points: 30
    }
  ];

  const completedSteps = onboardingSteps.filter(step => step.completed);
  const totalPoints = onboardingSteps.reduce((sum, step) => sum + step.points, 0);
  const earnedPoints = completedSteps.reduce((sum, step) => sum + step.points, 0);
  const progressPercentage = (earnedPoints / totalPoints) * 100;
  const isOnboardingComplete = completedSteps.length === onboardingSteps.length;

  // State for onboarding guide
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  
  // Check if user is new (show guide automatically for new users)
  const isNewUser = !isOnboardingComplete && services.length <= 1 && (Array.isArray(appointments) ? appointments : []).length === 0;
  
  // State for welcome notification popup
  const [showWelcomeNotification, setShowWelcomeNotification] = useState(true);
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // If no business is set up, show setup page
  if (!business) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-card rounded-2xl p-12 border border-border/50 max-w-2xl w-full text-center">
          <h2 className="text-3xl font-medium mb-4">Welcome to Besmi!</h2>
          <p className="text-muted-foreground mb-8">
            Let's set up your lash business profile to get started with your professional booking system.
          </p>
          <Button 
            onClick={() => setLocation("/setup")}
            className="px-8 py-3 rounded-full bg-[#FF8DC7] hover:bg-[#FF7AC0] text-white"
          >
            Set Up Your Business
          </Button>
        </div>
      </div>
    );
  }

  const handleDismissNotification = () => {
    setNotificationDismissed(true);
    setTimeout(() => setShowWelcomeNotification(false), 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const startY = e.touches[0].clientY;
    
    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const distance = startY - currentY;
      setSwipeDistance(Math.max(0, distance));
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      if (swipeDistance > 100) {
        handleDismissNotification();
      } else {
        setSwipeDistance(0);
      }
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Dismissible Welcome Notification Popup */}
      {showWelcomeNotification && !notificationDismissed && (
        <div 
          className="fixed top-4 left-4 right-4 z-50 animate-in slide-in-from-top-2 duration-500"
          onClick={handleDismissNotification}
        >
          <div 
            className={`bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/30 max-w-md mx-auto transform transition-all duration-300 cursor-pointer select-none ${
              notificationDismissed ? 'translate-y-[-100%] opacity-0' : 'translate-y-0 opacity-100'
            }`}
            style={{
              transform: `translateY(${isDragging ? -swipeDistance : notificationDismissed ? -100 : 0}px)`,
              opacity: isDragging ? Math.max(0.3, 1 - swipeDistance / 200) : (notificationDismissed ? 0 : 1)
            }}
            onTouchStart={handleTouchStart}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  Welcome back, {user?.firstName || user?.email?.split('@')[0]}
                </h2>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <div className="hidden sm:block">
                  <Sparkles className="h-8 w-8 text-pink-500" />
                </div>
                <Button
                  onClick={handleDismissNotification}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            {/* Swipe indicator */}
            {!isDragging && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                <div className="w-8 h-1 bg-gray-300 rounded-full opacity-50"></div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-20 space-y-6">
        
        {/* Dashboard Header */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
              <p className="text-gray-600">Your business overview and daily insights</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-white/80 text-gray-700 border-gray-200">
                {format(new Date(), 'EEEE, MMM d')}
              </Badge>
            </div>
          </div>
        </div>

        {/* Welcome Guide for New Users */}
        {isNewUser && !showOnboardingGuide && (
          <div className="bg-gradient-to-r from-[#FF8DC7]/10 via-purple-50 to-blue-50 border border-[#FF8DC7]/20 rounded-3xl shadow-xl p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#FF8DC7] to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Your Lash Business Dashboard!</h3>
              <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
                Let's get you set up with everything you need to start taking bookings and managing your lash business like a pro. 
                Our step-by-step guide will walk you through services, calendar, clients, payments, and forms.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => setShowOnboardingGuide(true)}
                  className="bg-gradient-to-r from-[#FF8DC7] to-purple-500 hover:from-[#FF7AC0] hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-3 text-lg font-medium"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Start Setup Guide
                </Button>
                <Button
                  onClick={() => setLocation('/services')}
                  variant="outline"
                  className="border-[#FF8DC7] text-[#FF8DC7] hover:bg-[#FF8DC7]/10 px-6 py-3"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Services First
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Apple-Inspired Minimalistic Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* YTD Revenue */}
          <div 
            className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-md border border-gray-200 hover:border-gray-300 transition-all duration-200 cursor-pointer"
            onClick={() => setLocation('/analytics')}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <TrendingUp className="w-5 h-5 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">YTD</span>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">${ytdRevenue.toFixed(0)}</p>
                <p className="text-sm text-gray-600">Year Revenue</p>
              </div>
            </div>
          </div>

          {/* Clients to Checkout */}
          <div 
            className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-md border border-gray-200 hover:border-gray-300 transition-all duration-200 cursor-pointer"
            onClick={() => {
              if (checkoutReadyAppointments.length > 0) {
                const element = document.getElementById('checkout-ready-appointments');
                element?.scrollIntoView({ behavior: 'smooth' });
              } else {
                setLocation('/pos');
              }
            }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <DollarSign className="w-5 h-5 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Checkout</span>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{checkoutReadyAppointments.length}</p>
                <p className="text-sm text-gray-600">Ready for Payment</p>
              </div>
            </div>
          </div>

          {/* Pending Requests */}
          <div 
            className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-md border border-gray-200 hover:border-gray-300 transition-all duration-200 cursor-pointer"
            onClick={() => {
              const element = document.getElementById('pending-requests');
              element?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <AlertCircle className="w-5 h-5 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</span>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{pendingAppointments.length}</p>
                <p className="text-sm text-gray-600">Waiting Approval</p>
              </div>
            </div>
          </div>

          {/* Page Editor */}
          <div 
            className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-md border border-gray-200 hover:border-gray-300 transition-all duration-200 cursor-pointer"
            onClick={() => setLocation('/customize')}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Edit className="w-5 h-5 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Editor</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Customize</p>
                <p className="text-xs text-gray-500">Booking Page</p>
              </div>
            </div>
          </div>

        </div>

        {/* Show Onboarding Guide Modal */}
        {showOnboardingGuide && (
          <OnboardingGuide 
            onClose={() => setShowOnboardingGuide(false)}
            completedSteps={completedSteps.map(step => step.id)}
          />
        )}

        {/* Pending Booking Requests */}
        {pendingAppointments.length > 0 && (
          <div id="pending-requests" className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-800">Pending Booking Requests</h3>
                  <p className="text-sm text-slate-600">{pendingAppointments.length} requests waiting for approval</p>
                </div>
              </div>

              <div className="space-y-4">
                {pendingAppointments.map((appointment) => (
                  <div 
                    key={appointment.id}
                    className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/30 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="space-y-4">
                      {/* Client Info */}
                      <div>
                        <h4 className="font-semibold text-slate-800 text-lg">
                          {appointment.client.firstName} {appointment.client.lastName}
                        </h4>
                        <p className="text-slate-600">{appointment.client.email}</p>
                        {appointment.client.phone && (
                          <p className="text-slate-600">{appointment.client.phone}</p>
                        )}
                      </div>
                      
                      {/* Appointment Details */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                        <div className="text-slate-600 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4" />
                            <span className="font-medium">{format(new Date(appointment.startTime), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{format(appointment.startTime, 'h:mm a')} - {format(appointment.endTime, 'h:mm a')}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3">
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                            {appointment.service.name}
                          </Badge>
                          <p className="text-lg font-semibold text-slate-800">${appointment.service?.price}</p>
                        </div>
                      </div>
                      
                      {/* Notes */}
                      {appointment.notes && (
                        <div className="bg-slate-50/80 p-3 rounded-xl">
                          <p className="text-slate-700 italic">"{appointment.notes}"</p>
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <Button
                          size="sm"
                          onClick={() => confirmMutation.mutate(appointment.id)}
                          disabled={confirmMutation.isPending}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white flex-1 sm:flex-none shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => denyMutation.mutate(appointment.id)}
                          disabled={denyMutation.isPending}
                          className="border-red-200 text-red-700 bg-white hover:bg-red-50 flex-1 sm:flex-none"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Deny
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Checkout Ready Appointments */}
        {checkoutReadyAppointments.length > 0 && (
          <div id="checkout-ready-appointments" className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-800">Checkout Ready for Payment</h3>
                  <p className="text-sm text-slate-600">{checkoutReadyAppointments.length} appointments need checkout</p>
                </div>
              </div>

              <div className="space-y-4">
                {checkoutReadyAppointments.map((appointment) => {
                  return (
                    <div key={appointment.id} className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/30 hover:shadow-lg transition-all duration-300">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1">
                          <h5 className="font-semibold text-slate-800 text-lg">
                            {appointment.client.firstName} {appointment.client.lastName}
                          </h5>
                          <p className="text-slate-600">{appointment.service.name}</p>
                          <p className="text-slate-500 text-sm">
                            {businessTimezone.formatDate(appointment.startTime, 'MMM d, yyyy')} • {businessTimezone.formatDate(appointment.startTime, 'h:mm a')} - {businessTimezone.formatDate(appointment.endTime, 'h:mm a')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xl font-bold text-slate-800">${appointment.service?.price}</p>
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                              Needs Checkout
                            </Badge>
                          </div>
                          <Button
                            onClick={() => setLocation(`/pos?customer=${appointment.client.id}&appointment=${appointment.id}&autoCheckout=true`)}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Checkout
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Today's Appointments */}
        <div id="todays-appointments" className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-800">Today's Appointments</h3>
                <p className="text-sm text-slate-600">{todayAppointments.length} appointments scheduled</p>
              </div>
            </div>

            {todayAppointments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 mb-6 text-lg">No appointments scheduled for today</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => setLocation('/calendar')}
                    className="bg-gradient-to-r from-blue-400/90 to-indigo-400/90 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm rounded-xl font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Appointment
                  </Button>
                  <Button
                    onClick={() => setLocation('/calendar')}
                    variant="ghost"
                    className="bg-white/60 backdrop-blur-sm border border-white/40 text-blue-700 hover:bg-white/80 hover:border-blue-300/50 hover:text-blue-600 transition-all duration-300 shadow-sm hover:shadow-md rounded-xl"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Calendar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {todayAppointments.map((appointment) => {
                  return (
                    <div key={appointment.id} className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/30 hover:shadow-lg transition-all duration-300">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1">
                          <h5 className="font-semibold text-slate-800 text-lg">
                            {appointment.client.firstName} {appointment.client.lastName}
                          </h5>
                          <p className="text-slate-600">{appointment.service.name}</p>
                          <p className="text-slate-500 text-sm">
                            {businessTimezone.formatDate(appointment.startTime, 'h:mm a')} - {businessTimezone.formatDate(appointment.endTime, 'h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-slate-800">${appointment.service?.price}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Help & Guide Access */}
        {!isNewUser && (
          <div className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-slate-600 text-sm font-medium">Need Help Getting Started?</p>
                <p className="text-slate-500 text-xs">Access our comprehensive setup guide anytime</p>
              </div>
            </div>
            <Button
              onClick={() => setShowOnboardingGuide(true)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Open Setup Guide
            </Button>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Today's Revenue */}
          <div className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Today's Revenue</p>
                <p className="text-2xl font-bold text-slate-800">${todayRevenue.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Today's Appointments */}
          <div className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Today's Appointments</p>
                <p className="text-2xl font-bold text-slate-800">{todayAppointments.length}</p>
              </div>
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Monthly Revenue</p>
                <p className="text-2xl font-bold text-slate-800">${monthRevenue.toFixed(2)}</p>
                {monthlyGrowth !== 0 && (
                  <p className={`text-xs font-medium ${monthlyGrowth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {monthlyGrowth > 0 ? '+' : ''}{monthlyGrowth.toFixed(1)}% from last month
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Share Your Booking Page */}
          <div className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-rose-500 to-pink-500 rounded-2xl flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-slate-600 text-sm font-medium">Share Your Booking Page</p>
                <p className="text-slate-500 text-xs">Perfect for posting on your socials!</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => {
                  const url = `${window.location.origin}/booking/${business?.bookingPageSlug || 'my-business'}`;
                  if (isMobileApp) {
                    openExternalBrowser(url);
                  } else {
                    window.open(url, '_blank');
                  }
                }}
                variant="ghost"
                size="sm"
                className="bg-white/60 backdrop-blur-sm border border-white/40 text-slate-700 hover:bg-white/80 hover:border-blue-300/50 hover:text-blue-600 transition-all duration-300 shadow-sm hover:shadow-md rounded-xl"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View
              </Button>
              <Button
                onClick={() => setLocation('/customize')}
                variant="ghost"
                size="sm"
                className="bg-white/60 backdrop-blur-sm border border-white/40 text-slate-700 hover:bg-white/80 hover:border-purple-300/50 hover:text-purple-600 transition-all duration-300 shadow-sm hover:shadow-md rounded-xl"
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button
                onClick={() => {
                  const bookingUrl = `${window.location.origin}/booking/${business?.bookingPageSlug || 'my-business'}`;
                  navigator.clipboard.writeText(bookingUrl);
                  toast({
                    title: "Link copied!",
                    description: "Your booking page URL is ready to share on social media",
                  });
                }}
                size="sm"
                className="bg-gradient-to-r from-rose-400/90 to-pink-400/90 hover:from-rose-500 hover:to-pink-500 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm rounded-xl font-medium"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
            </div>
          </div>

        </div>



        {/* AI-Powered Business Insights */}
        <BusinessInsights />

      </div>
    </div>
  );
}
