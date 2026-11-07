package com.amanaija.app;

import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;

// Lets the website ask for the phone's location through Android's normal permission prompt.
public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
    }
}
